require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");
const { Resend } = require("resend");
const { Pool } = require("pg");

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 10000;

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  "https://zevoria-store.vercel.app";

const ADMIN_KEY = process.env.ADMIN_KEY;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || "onboarding@resend.dev";

/* =========================================================
   DATABASE - SUPABASE POSTGRESQL
========================================================= */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Supabase Session Pooler uses SSL.
  ssl: {
    rejectUnauthorized: false
  },

  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    console.log("Connecting to Supabase PostgreSQL...");

    await client.query("SELECT 1");

    console.log("Supabase PostgreSQL connection successful.");

    /*
      Your Supabase SQL already created the main tables.

      These ALTER statements make sure the columns required
      by this backend exist.
    */

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone text;
    `);

    await client.query(`
      ALTER TABLE admin_sessions
      ADD COLUMN IF NOT EXISTS csrf_token text;
    `);

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS access_token_hash text;
    `);

    console.log("Database structure checked.");

    /* =====================================================
       SEED PRODUCTS IF EMPTY
    ===================================================== */

    const countResult = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM products
    `);

    const productCount = countResult.rows[0].count;

    if (productCount === 0) {
      const products = [
        {
          id: 1,
          name: "No. 01 Noir",
          category: "men",
          price: 1499,
          stock: 25,
          note: "Amber • Oud • Vanilla"
        },
        {
          id: 2,
          name: "No. 02 Santal",
          category: "unisex",
          price: 1699,
          stock: 25,
          note: "Sandalwood • Musk • Cedar"
        },
        {
          id: 3,
          name: "No. 03 Bloom",
          category: "women",
          price: 1399,
          stock: 25,
          note: "Rose • Peony • Vanilla"
        },
        {
          id: 4,
          name: "No. 04 Oud",
          category: "unisex",
          price: 899,
          stock: 25,
          note: "Oud • Saffron • Amber"
        },
        {
          id: 5,
          name: "No. 05 Azure",
          category: "men",
          price: 1599,
          stock: 25,
          note: "Bergamot • Marine • Musk"
        },
        {
          id: 6,
          name: "No. 06 Velvet",
          category: "women",
          price: 1499,
          stock: 25,
          note: "Iris • Tonka • Amber"
        }
      ];

      for (const product of products) {
        await client.query(
          `
          INSERT INTO products
          (
            id,
            name,
            category,
            price,
            stock,
            description,
            active
          )
          VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT (id) DO NOTHING
          `,
          [
            product.id,
            product.name,
            product.category,
            product.price,
            product.stock,
            product.note
          ]
        );
      }

      console.log("ZEVORIA products seeded.");
    } else {
      console.log(
        `Products already exist: ${productCount}`
      );
    }
  } finally {
    client.release();
  }
}

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many admin login attempts. Please try again later."
  }
});

app.use(generalLimiter);

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createRandomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

/* =========================================================
   ADMIN COOKIE
========================================================= */

function setAdminCookie(res, token) {
  const maxAge = 8 * 60 * 60;

  res.setHeader(
    "Set-Cookie",
    [
      `zevoria_admin_session=${encodeURIComponent(token)}`,
      "HttpOnly",
      "Secure",
      "SameSite=None",
      "Path=/",
      `Max-Age=${maxAge}`
    ].join("; ")
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    [
      "zevoria_admin_session=",
      "HttpOnly",
      "Secure",
      "SameSite=None",
      "Path=/",
      "Max-Age=0"
    ].join("; ")
  );
}

/* =========================================================
   ADMIN AUTH
========================================================= */

async function requireAdmin(req, res, next) {
  try {
    const sessionToken = getCookie(
      req,
      "zevoria_admin_session"
    );

    if (!sessionToken) {
      return res.status(401).json({
        error: "Admin login required"
      });
    }

    const tokenHash = hashToken(sessionToken);

    const result = await pool.query(
      `
      SELECT *
      FROM admin_sessions
      WHERE token_hash = $1
      AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    const session = result.rows[0];

    if (!session) {
      clearAdminCookie(res);

      return res.status(401).json({
        error: "Admin session expired"
      });
    }

    req.adminSession = session;

    next();
  } catch (error) {
    console.error("Admin authentication error:", error);

    return res.status(500).json({
      error: "Admin authentication failed"
    });
  }
}

/* =========================================================
   CSRF
========================================================= */

function requireAdminCsrf(req, res, next) {
  const csrfHeader = req.headers["x-csrf-token"];

  if (!csrfHeader) {
    return res.status(403).json({
      error: "CSRF token required"
    });
  }

  if (csrfHeader !== req.adminSession.csrf_token) {
    return res.status(403).json({
      error: "Invalid CSRF token"
    });
  }

  next();
}

/* =========================================================
   BASIC ROUTES
========================================================= */

app.get("/", (req, res) => {
  res.json({
    name: "ZEVORIA API",
    status: "running"
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      database: "connected"
    });
  } catch (error) {
    console.error("Health check database error:", error);

    res.status(500).json({
      ok: false,
      database: "disconnected"
    });
  }
});

/* =========================================================
   PRODUCTS
========================================================= */

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        category,
        price,
        stock,
        description AS note
      FROM products
      WHERE active = true
      ORDER BY id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Products error:", error);

    res.status(500).json({
      error: "Could not load products"
    });
  }
});

/* =========================================================
   SIGNUP
========================================================= */

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(150),
  phone: z.string().min(7).max(30).optional(),
  password: z.string().min(6).max(100)
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const data = signupSchema.parse(req.body);

    const email = data.email
      .trim()
      .toLowerCase();

    const existing = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "Email already registered"
      });
    }

    const passwordHash = await bcrypt.hash(
      data.password,
      12
    );

    const result = await pool.query(
      `
      INSERT INTO users
      (
        name,
        email,
        phone,
        password_hash
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, phone
      `,
      [
        data.name.trim(),
        email,
        data.phone || null,
        passwordHash
      ]
    );

    const user = result.rows[0];

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || ""
      }
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid signup details"
      });
    }

    res.status(500).json({
      error: "Signup failed"
    });
  }
});

/* =========================================================
   LOGIN
========================================================= */

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const email = data.email
      .trim()
      .toLowerCase();

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const validPassword = await bcrypt.compare(
      data.password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || ""
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid login details"
      });
    }

    res.status(500).json({
      error: "Login failed"
    });
  }
});

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  adminLoginLimiter,
  async (req, res) => {
    try {
      if (!ADMIN_KEY) {
        return res.status(500).json({
          error:
            "ADMIN_KEY is not configured on server"
        });
      }

      const submittedKey =
        typeof req.body?.adminKey === "string"
          ? req.body.adminKey
          : "";

      if (!submittedKey) {
        return res.status(400).json({
          error: "Admin key is required"
        });
      }

      const submittedHash = crypto
        .createHash("sha256")
        .update(submittedKey)
        .digest();

      const actualHash = crypto
        .createHash("sha256")
        .update(ADMIN_KEY)
        .digest();

      const valid =
        submittedHash.length === actualHash.length &&
        crypto.timingSafeEqual(
          submittedHash,
          actualHash
        );

      if (!valid) {
        return res.status(401).json({
          error: "Invalid admin key"
        });
      }

      const sessionToken = createRandomToken();
      const tokenHash = hashToken(sessionToken);
      const csrfToken = createRandomToken();

      const expiresAt = new Date(
        Date.now() + 8 * 60 * 60 * 1000
      );

      const result = await pool.query(
        `
        INSERT INTO admin_sessions
        (
          token_hash,
          csrf_token,
          expires_at,
          created_at
        )
        VALUES ($1, $2, $3, NOW())
        RETURNING expires_at
        `,
        [
          tokenHash,
          csrfToken,
          expiresAt
        ]
      );

      setAdminCookie(
        res,
        sessionToken
      );

      res.json({
        success: true,
        csrfToken,
        expiresAt: result.rows[0].expires_at
      });
    } catch (error) {
      console.error(
        "Admin login error:",
        error
      );

      res.status(500).json({
        error: "Admin login failed"
      });
    }
  }
);

/* =========================================================
   ADMIN SESSION CHECK
========================================================= */

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {
    res.json({
      authenticated: true,
      expiresAt:
        req.adminSession.expires_at,
      csrfToken:
        req.adminSession.csrf_token
    });
  }
);

/* =========================================================
   ADMIN LOGOUT
========================================================= */

app.post(
  "/api/admin/logout",
  requireAdmin,
  requireAdminCsrf,
  async (req, res) => {
    try {
      await pool.query(
        `
        DELETE FROM admin_sessions
        WHERE id = $1
        `,
        [req.adminSession.id]
      );

      clearAdminCookie(res);

      res.json({
        success: true
      });
    } catch (error) {
      console.error("Admin logout error:", error);

      res.status(500).json({
        error: "Logout failed"
      });
    }
  }
);

/* =========================================================
   ADMIN ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const ordersResult = await pool.query(`
        SELECT
          id,
          customer_name,
          customer_email,
          customer_phone AS phone,
          address,
          total,
          status,
          payment_method,
          created_at
        FROM orders
        ORDER BY id DESC
      `);

      const orders = ordersResult.rows;

      for (const order of orders) {
        const itemsResult = await pool.query(
          `
          SELECT
            id,
            order_id,
            product_id,
            product_name AS name,
            quantity AS qty,
            price
          FROM order_items
          WHERE order_id = $1
          ORDER BY id ASC
          `,
          [order.id]
        );

        order.items = itemsResult.rows;
      }

      res.json(orders);
    } catch (error) {
      console.error("Admin orders error:", error);

      res.status(500).json({
        error: "Could not load orders"
      });
    }
  }
);

/* =========================================================
   ADMIN STATUS UPDATE
========================================================= */

const allowedStatuses = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled"
];

app.patch(
  "/api/admin/orders/:id/status",
  requireAdmin,
  requireAdminCsrf,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const status =
        typeof req.body?.status === "string"
          ? req.body.status
          : "";

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: "Invalid order ID"
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid order status"
        });
      }

      const orderResult = await pool.query(
        `
        SELECT id
        FROM orders
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      await pool.query(
        `
        UPDATE orders
        SET status = $1
        WHERE id = $2
        `,
        [status, id]
      );

      res.json({
        success: true,
        orderId: id,
        status
      });
    } catch (error) {
      console.error(
        "Status update error:",
        error
      );

      res.status(500).json({
        error: "Could not update order status"
      });
    }
  }
);

/* =========================================================
   ADMIN STATS
========================================================= */

app.get(
  "/api/admin/stats",
  requireAdmin,
  async (req, res) => {
    try {
      const totalOrdersResult =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM orders
        `);

      const totalSalesResult =
        await pool.query(`
          SELECT
            COALESCE(SUM(total), 0)::numeric AS total
          FROM orders
          WHERE status != 'cancelled'
        `);

      const pendingResult =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM orders
          WHERE status = 'pending'
        `);

      const confirmedResult =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM orders
          WHERE status = 'confirmed'
        `);

      const shippedResult =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM orders
          WHERE status = 'shipped'
        `);

      const deliveredResult =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM orders
          WHERE status = 'delivered'
        `);

      res.json({
        totalOrders:
          totalOrdersResult.rows[0].count,

        totalSales:
          Number(
            totalSalesResult.rows[0].total
          ),

        pending:
          pendingResult.rows[0].count,

        confirmed:
          confirmedResult.rows[0].count,

        shipped:
          shippedResult.rows[0].count,

        delivered:
          deliveredResult.rows[0].count
      });
    } catch (error) {
      console.error("Admin stats error:", error);

      res.status(500).json({
        error: "Could not load statistics"
      });
    }
  }
);

/* =========================================================
   ORDER CONFIRMATION EMAIL
========================================================= */

async function sendOrderConfirmationEmail({
  orderId,
  customerName,
  customerEmail,
  address,
  items,
  total
}) {
  if (!resend) {
    console.log(
      `Order #${orderId}: RESEND_API_KEY is missing`
    );

    return {
      sent: false,
      email: customerEmail || null
    };
  }

  if (!customerEmail) {
    console.log(
      `Order #${orderId}: no customer email was provided`
    );

    return {
      sent: false,
      email: null
    };
  }

  try {
    const itemRows = items
      .map(
        (item) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${escapeHtml(item.name)}
            </td>

            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${item.qty}
            </td>

            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ₹${Number(item.price).toLocaleString("en-IN")}
            </td>
          </tr>
        `
      )
      .join("");

    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: customerEmail,

      subject:
        `ZEVORIA Order Confirmed — #${orderId}`,

      html: `
        <!DOCTYPE html>

        <html>
          <body
            style="
              font-family:Arial,sans-serif;
              background:#f6f2ea;
              padding:30px;
            "
          >

            <div
              style="
                max-width:650px;
                margin:auto;
                background:#fff;
                padding:30px;
                border-radius:12px;
              "
            >

              <h1 style="letter-spacing:4px;">
                ZEVORIA
              </h1>

              <h2>
                Order Confirmed
              </h2>

              <p>
                Hello ${escapeHtml(customerName)},
              </p>

              <p>
                Thank you for shopping with ZEVORIA.
                Your order has been successfully placed.
              </p>

              <p>
                <strong>
                  Order #${orderId}
                </strong>
              </p>

              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                "
              >

                <thead>
                  <tr>

                    <th
                      style="
                        text-align:left;
                        padding:10px;
                      "
                    >
                      Product
                    </th>

                    <th
                      style="
                        text-align:left;
                        padding:10px;
                      "
                    >
                      Qty
                    </th>

                    <th
                      style="
                        text-align:left;
                        padding:10px;
                      "
                    >
                      Price
                    </th>

                  </tr>
                </thead>

                <tbody>
                  ${itemRows}
                </tbody>

              </table>

              <h2>
                Total:
                ₹${Number(total).toLocaleString("en-IN")}
              </h2>

              <h3>
                Delivery Address
              </h3>

              <p>
                ${escapeHtml(address)}
              </p>

              <p>
                Payment Method:
                <strong>
                  Cash on Delivery
                </strong>
              </p>

              <hr>

              <p>
                Thank you for choosing ZEVORIA.
              </p>

            </div>

          </body>
        </html>
      `
    });

    /*
      Resend can return an error object instead of throwing.
      Therefore we check result.error.
    */

    if (result && result.error) {
      console.error(
        `Order #${orderId} email failed:`,
        result.error
      );

      return {
        sent: false,
        email: customerEmail,
        error: result.error.message
      };
    }

    console.log(
      `Order #${orderId} email sent successfully → ${customerEmail}`
    );

    return {
      sent: true,
      email: customerEmail,
      result
    };
  } catch (error) {
    console.error(
      `Order #${orderId} email sending failed to ${customerEmail}:`,
      error
    );

    return {
      sent: false,
      email: customerEmail,
      error: error.message
    };
  }
}

/* =========================================================
   CREATE ORDER
========================================================= */

const orderSchema = z.object({
  customerName: z.string().min(2).max(100),

  customerEmail: z
    .string()
    .email()
    .max(150)
    .optional()
    .or(z.literal("")),

  phone: z.string().min(7).max(30),

  address: z.string().min(5).max(500),

  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),

        qty: z
          .number()
          .int()
          .positive()
          .max(20)
      })
    )
    .min(1)
});

app.post("/api/orders", async (req, res) => {
  const client = await pool.connect();

  try {
    const data = orderSchema.parse(req.body);

    const normalizedCustomerEmail =
      data.customerEmail
        ? data.customerEmail.trim().toLowerCase()
        : null;

    console.log(
      `New order request → customer email: ${
        normalizedCustomerEmail || "none"
      }`
    );

    await client.query("BEGIN");

    const checkedItems = [];

    /*
      Combine duplicate product IDs before processing.
      This prevents someone from ordering the same product
      multiple times in separate entries and bypassing stock.
    */

    const quantities = new Map();

    for (const item of data.items) {
      const current =
        quantities.get(item.productId) || 0;

      quantities.set(
        item.productId,
        current + item.qty
      );
    }

    for (const [productId, qty] of quantities) {
      if (qty > 20) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "Maximum quantity for one product is 20"
        });
      }

      /*
        FOR UPDATE locks the product row during
        order creation so two customers cannot
        safely purchase the same last stock.
      */

      const productResult =
        await client.query(
          `
          SELECT
            id,
            name,
            price,
            stock,
            active
          FROM products
          WHERE id = $1
          FOR UPDATE
          `,
          [productId]
        );

      const product =
        productResult.rows[0];

      if (!product || !product.active) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            `Product ${productId} not found`
        });
      }

      if (product.stock < qty) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            `${product.name} does not have enough stock`
        });
      }

      checkedItems.push({
        productId: product.id,
        name: product.name,
        qty,
        price: Number(product.price)
      });
    }

    const total = checkedItems.reduce(
      (sum, item) =>
        sum + item.price * item.qty,
      0
    );

    /*
      PRIVATE ORDER TOKEN
    */

    const orderAccessToken =
      createRandomToken();

    const orderAccessTokenHash =
      hashToken(orderAccessToken);

    /*
      Create order
    */

    const orderResult =
      await client.query(
        `
        INSERT INTO orders
        (
          customer_name,
          customer_email,
          customer_phone,
          address,
          total,
          status,
          payment_method,
          access_token_hash
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          'pending',
          'COD',
          $6
        )
        RETURNING id, created_at
        `,
        [
          data.customerName.trim(),
          normalizedCustomerEmail,
          data.phone.trim(),
          data.address.trim(),
          total,
          orderAccessTokenHash
        ]
      );

    const orderId =
      Number(orderResult.rows[0].id);

    /*
      Insert order items
    */

    for (const item of checkedItems) {
      await client.query(
        `
        INSERT INTO order_items
        (
          order_id,
          product_id,
          product_name,
          price,
          quantity
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          orderId,
          item.productId,
          item.name,
          item.price,
          item.qty
        ]
      );

      /*
        Decrease stock
      */

      await client.query(
        `
        UPDATE products
        SET stock = stock - $1
        WHERE id = $2
        `,
        [
          item.qty,
          item.productId
        ]
      );
    }

    await client.query("COMMIT");

    console.log(
      `Order #${orderId} created → customer email: ${
        normalizedCustomerEmail || "none"
      }`
    );

    /*
      Email is intentionally NOT allowed to break
      successful order creation.
    */

    void sendOrderConfirmationEmail({
      orderId,
      customerName: data.customerName,
      customerEmail: normalizedCustomerEmail,
      address: data.address,
      items: checkedItems,
      total
    });

    /*
      The order token is returned only once.
      Frontend must save it with the order ID.
    */

    res.status(201).json({
      orderId,
      total,
      paymentMethod: "COD",
      orderToken: orderAccessToken
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Ignore rollback error.
    }

    console.error(
      "Order error:",
      error
    );

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid order details"
      });
    }

    res.status(500).json({
      error: "Could not create order"
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   SECURE CUSTOMER ORDER LOOKUP
========================================================= */

app.get(
  "/api/orders/:id",
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: "Invalid order ID"
        });
      }

      const orderToken =
        typeof req.headers["x-order-token"] ===
        "string"
          ? req.headers["x-order-token"]
          : "";

      if (!orderToken) {
        return res.status(401).json({
          error:
            "Order access token required"
        });
      }

      const tokenHash =
        hashToken(orderToken);

      const orderResult =
        await pool.query(
          `
          SELECT
            id,
            customer_name,
            customer_email,
            customer_phone AS phone,
            address,
            total,
            status,
            payment_method,
            created_at
          FROM orders
          WHERE id = $1
          AND access_token_hash = $2
          LIMIT 1
          `,
          [
            id,
            tokenHash
          ]
        );

      const order =
        orderResult.rows[0];

      if (!order) {
        return res.status(404).json({
          error:
            "Order not found or access denied"
        });
      }

      const itemsResult =
        await pool.query(
          `
          SELECT
            id,
            order_id,
            product_id,
            product_name AS name,
            quantity AS qty,
            price
          FROM order_items
          WHERE order_id = $1
          ORDER BY id ASC
          `,
          [id]
        );

      res.json({
        ...order,
        items: itemsResult.rows
      });
    } catch (error) {
      console.error(
        "Order lookup error:",
        error
      );

      res.status(500).json({
        error: "Could not load order"
      });
    }
  }
);

/* =========================================================
   CLEAN EXPIRED ADMIN SESSIONS
========================================================= */

setInterval(async () => {
  try {
    await pool.query(`
      DELETE FROM admin_sessions
      WHERE expires_at <= NOW()
    `);
  } catch (error) {
    console.error(
      "Session cleanup error:",
      error
    );
  }
}, 60 * 60 * 1000);

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(
        `ZEVORIA backend running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Could not start ZEVORIA backend:",
      error
    );

    process.exit(1);
  }
}

startServer();

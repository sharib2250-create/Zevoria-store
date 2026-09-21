require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");
const { Resend } = require("resend");

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
   DATABASE
========================================================= */

const db = new Database("zevovia.db");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  access_token_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT UNIQUE NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`);

/* =========================================================
   DATABASE MIGRATIONS
========================================================= */

let orderColumns = db
  .prepare("PRAGMA table_info(orders)")
  .all()
  .map((x) => x.name);

if (!orderColumns.includes("customer_email")) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN customer_email TEXT
  `);
}

orderColumns = db
  .prepare("PRAGMA table_info(orders)")
  .all()
  .map((x) => x.name);

if (!orderColumns.includes("access_token_hash")) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN access_token_hash TEXT
  `);
}

/* =========================================================
   PRODUCTS
========================================================= */

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

const insertProduct = db.prepare(`
  INSERT INTO products
  (
    id,
    name,
    category,
    price,
    stock,
    note
  )
  VALUES (?, ?, ?, ?, ?, ?)
`);

const existingProductCount = db
  .prepare("SELECT COUNT(*) AS count FROM products")
  .get().count;

if (existingProductCount === 0) {
  const seedProducts = db.transaction(() => {
    for (const product of products) {
      insertProduct.run(
        product.id,
        product.name,
        product.category,
        product.price,
        product.stock,
        product.note
      );
    }
  });

  seedProducts();
}

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

function requireAdmin(req, res, next) {
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

  const session = db
    .prepare(`
      SELECT *
      FROM admin_sessions
      WHERE token_hash = ?
      AND expires_at > ?
    `)
    .get(tokenHash, Date.now());

  if (!session) {
    clearAdminCookie(res);

    return res.status(401).json({
      error: "Admin session expired"
    });
  }

  req.adminSession = session;

  next();
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

app.get("/api/health", (req, res) => {
  res.json({
    ok: true
  });
});

/* =========================================================
   PRODUCTS
========================================================= */

app.get("/api/products", (req, res) => {
  const rows = db
    .prepare(`
      SELECT
        id,
        name,
        category,
        price,
        stock,
        note
      FROM products
      ORDER BY id ASC
    `)
    .all();

  res.json(rows);
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

    const existing = db
      .prepare(`
        SELECT id
        FROM users
        WHERE email = ?
      `)
      .get(email);

    if (existing) {
      return res.status(409).json({
        error: "Email already registered"
      });
    }

    const passwordHash = await bcrypt.hash(
      data.password,
      12
    );

    const result = db
      .prepare(`
        INSERT INTO users
        (
          name,
          email,
          phone,
          password_hash
        )
        VALUES (?, ?, ?, ?)
      `)
      .run(
        data.name.trim(),
        email,
        data.phone || null,
        passwordHash
      );

    res.status(201).json({
      user: {
        id: result.lastInsertRowid,
        name: data.name.trim(),
        email,
        phone: data.phone || ""
      }
    });
  } catch (error) {
    res.status(400).json({
      error: "Invalid signup details"
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

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE email = ?
      `)
      .get(email);

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
    res.status(400).json({
      error: "Invalid login details"
    });
  }
});

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  adminLoginLimiter,
  (req, res) => {
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

      const tokenHash = hashToken(
        sessionToken
      );

      const csrfToken = createRandomToken();

      const expiresAt =
        Date.now() +
        8 * 60 * 60 * 1000;

      db.prepare(`
        INSERT INTO admin_sessions
        (
          token_hash,
          csrf_token,
          expires_at,
          created_at
        )
        VALUES (?, ?, ?, ?)
      `).run(
        tokenHash,
        csrfToken,
        expiresAt,
        Date.now()
      );

      setAdminCookie(
        res,
        sessionToken
      );

      res.json({
        success: true,
        csrfToken,
        expiresAt
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
  (req, res) => {
    db.prepare(`
      DELETE FROM admin_sessions
      WHERE id = ?
    `).run(req.adminSession.id);

    clearAdminCookie(res);

    res.json({
      success: true
    });
  }
);

/* =========================================================
   ADMIN ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  (req, res) => {
    const orders = db
      .prepare(`
        SELECT
          id,
          customer_name,
          customer_email,
          phone,
          address,
          total,
          status,
          created_at
        FROM orders
        ORDER BY id DESC
      `)
      .all();

    const itemQuery = db.prepare(`
      SELECT
        id,
        order_id,
        product_id,
        name,
        qty,
        price
      FROM order_items
      WHERE order_id = ?
    `);

    const result = orders.map((order) => ({
      ...order,
      items: itemQuery.all(order.id)
    }));

    res.json(result);
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
  (req, res) => {
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

    const order = db
      .prepare(`
        SELECT id
        FROM orders
        WHERE id = ?
      `)
      .get(id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    db.prepare(`
      UPDATE orders
      SET status = ?
      WHERE id = ?
    `).run(status, id);

    res.json({
      success: true,
      orderId: id,
      status
    });
  }
);

/* =========================================================
   ADMIN STATS
========================================================= */

app.get(
  "/api/admin/stats",
  requireAdmin,
  (req, res) => {
    const totalOrders = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM orders
      `)
      .get().count;

    const totalSales = db
      .prepare(`
        SELECT
          COALESCE(SUM(total), 0) AS total
        FROM orders
        WHERE status != 'cancelled'
      `)
      .get().total;

    const pending = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM orders
        WHERE status = 'pending'
      `)
      .get().count;

    const confirmed = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM orders
        WHERE status = 'confirmed'
      `)
      .get().count;

    const shipped = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM orders
        WHERE status = 'shipped'
      `)
      .get().count;

    const delivered = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM orders
        WHERE status = 'delivered'
      `)
      .get().count;

    res.json({
      totalOrders,
      totalSales,
      pending,
      confirmed,
      shipped,
      delivered
    });
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
  if (!resend || !customerEmail) {
    return false;
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

    await resend.emails.send({
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

    return true;
  } catch (error) {
    console.error(
      "Email sending failed:",
      error
    );

    return false;
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

app.post("/api/orders", (req, res) => {
  try {
    const data = orderSchema.parse(req.body);

    const productQuery = db.prepare(`
      SELECT *
      FROM products
      WHERE id = ?
    `);

    const checkedItems = [];

    for (const item of data.items) {
      const product = productQuery.get(
        item.productId
      );

      if (!product) {
        return res.status(400).json({
          error:
            `Product ${item.productId} not found`
        });
      }

      if (product.stock < item.qty) {
        return res.status(400).json({
          error:
            `${product.name} does not have enough stock`
        });
      }

      checkedItems.push({
        productId: product.id,
        name: product.name,
        qty: item.qty,
        price: product.price
      });
    }

    const total = checkedItems.reduce(
      (sum, item) =>
        sum + item.price * item.qty,
      0
    );

    /* PRIVATE ORDER TOKEN */

    const orderAccessToken =
      createRandomToken();

    const orderAccessTokenHash =
      hashToken(orderAccessToken);

    const createOrder = db.transaction(() => {
      const orderResult = db
        .prepare(`
          INSERT INTO orders
          (
            customer_name,
            customer_email,
            phone,
            address,
            total,
            status,
            access_token_hash
          )
          VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `)
        .run(
          data.customerName.trim(),

          data.customerEmail
            ? data.customerEmail
                .trim()
                .toLowerCase()
            : null,

          data.phone.trim(),

          data.address.trim(),

          total,

          orderAccessTokenHash
        );

      const orderId = Number(
        orderResult.lastInsertRowid
      );

      const insertItem = db.prepare(`
        INSERT INTO order_items
        (
          order_id,
          product_id,
          name,
          qty,
          price
        )
        VALUES (?, ?, ?, ?, ?)
      `);

      const decreaseStock = db.prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ?
      `);

      for (const item of checkedItems) {
        insertItem.run(
          orderId,
          item.productId,
          item.name,
          item.qty,
          item.price
        );

        decreaseStock.run(
          item.qty,
          item.productId
        );
      }

      return orderId;
    });

    const orderId = createOrder();

    sendOrderConfirmationEmail({
      orderId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      address: data.address,
      items: checkedItems,
      total
    }).then((emailSent) => {
      console.log(
        `Order #${orderId} email sent:`,
        emailSent
      );
    });

    /*
      The order token is returned only once.
      The frontend must save it together with
      the order ID.

      It is required for secure tracking.
    */

    res.status(201).json({
      orderId,
      total,
      paymentMethod: "COD",
      orderToken: orderAccessToken
    });
  } catch (error) {
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
  }
});

/* =========================================================
   SECURE CUSTOMER ORDER LOOKUP
========================================================= */

app.get(
  "/api/orders/:id",
  (req, res) => {
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

      const order = db
        .prepare(`
          SELECT
            id,
            customer_name,
            customer_email,
            phone,
            address,
            total,
            status,
            created_at
          FROM orders
          WHERE id = ?
          AND access_token_hash = ?
        `)
        .get(
          id,
          tokenHash
        );

      if (!order) {
        return res.status(404).json({
          error:
            "Order not found or access denied"
        });
      }

      const items = db
        .prepare(`
          SELECT
            id,
            order_id,
            product_id,
            name,
            qty,
            price
          FROM order_items
          WHERE order_id = ?
        `)
        .all(id);

      res.json({
        ...order,
        items
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

setInterval(() => {
  try {
    db.prepare(`
      DELETE FROM admin_sessions
      WHERE expires_at <= ?
    `).run(Date.now());
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

app.listen(PORT, () => {
  console.log(
    `ZEVORIA backend running on port ${PORT}`
  );
});

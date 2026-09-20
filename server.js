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

const PORT = process.env.PORT || 4000;
const db = new Database("zevoria.db");

/* =========================================================
   SECURITY CONFIG
========================================================= */

const SESSION_DAYS = 7;
const ORDER_ACCESS_DAYS = 30;

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.randomBytes(48).toString("hex");

if (!process.env.SESSION_SECRET) {
  console.warn(
    "WARNING: SESSION_SECRET is not configured. " +
    "Set SESSION_SECRET in Render Environment Variables."
  );
}

if (!process.env.ADMIN_KEY) {
  console.warn(
    "WARNING: ADMIN_KEY is not configured."
  );
}

/* =========================================================
   RESEND EMAIL
========================================================= */

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || "onboarding@resend.dev";

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
  "https://zevoria-store.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  ...(process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
];

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error("CORS: origin not allowed")
    );
  }
}));

app.use(express.json({
  limit: "100kb"
}));

/* =========================================================
   GLOBAL RATE LIMIT
========================================================= */

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

/* =========================================================
   STRICT RATE LIMITERS
========================================================= */

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many authentication attempts. Please try again later."
  }
});

const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many admin login attempts. Please try again later."
  }
});

const orderRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many order requests. Please try again later."
  }
});

/* =========================================================
   DATABASE
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  product_id INTEGER,
  name TEXT,
  qty INTEGER,
  price INTEGER
);

CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

/* =========================================================
   DATABASE MIGRATIONS
========================================================= */

/* Add customer_email to old databases */

try {

  const columns = db
    .prepare("PRAGMA table_info(orders)")
    .all();

  const hasEmailColumn = columns.some(
    column => column.name === "customer_email"
  );

  if (!hasEmailColumn) {

    db.exec(
      "ALTER TABLE orders ADD COLUMN customer_email TEXT"
    );

    console.log(
      "Added customer_email column to orders"
    );
  }

} catch (err) {

  console.error(
    "Order email migration error:",
    err
  );
}


/* Add user_id to old databases */

try {

  const columns = db
    .prepare("PRAGMA table_info(orders)")
    .all();

  const hasUserIdColumn = columns.some(
    column => column.name === "user_id"
  );

  if (!hasUserIdColumn) {

    db.exec(
      "ALTER TABLE orders ADD COLUMN user_id INTEGER"
    );

    console.log(
      "Added user_id column to orders"
    );
  }

} catch (err) {

  console.error(
    "Order user migration error:",
    err
  );
}

/* =========================================================
   PRODUCTS
========================================================= */

const seedProducts = [
  [1, "No. 01 Noir", "men", 1499, 25, "Amber • Oud • Vanilla"],
  [2, "No. 02 Santal", "unisex", 1699, 25, "Sandalwood • Musk • Cedar"],
  [3, "No. 03 Bloom", "women", 1399, 25, "Rose • Peony • Vanilla"],
  [4, "No. 04 Oud", "unisex", 899, 25, "Oud • Saffron • Amber"],
  [5, "No. 05 Azure", "men", 1599, 25, "Bergamot • Marine • Musk"],
  [6, "No. 06 Velvet", "women", 1499, 25, "Iris • Tonka • Amber"]
];

const insertProduct = db.prepare(
  `INSERT OR IGNORE INTO products
   (id,name,category,price,stock,note)
   VALUES (?,?,?,?,?,?)`
);

for (const product of seedProducts) {
  insertProduct.run(...product);
}

/* =========================================================
   TOKEN SECURITY
========================================================= */

/*
  Token format:

  base64url(payload).base64url(signature)

  The signature is created using HMAC-SHA256.
*/

function base64UrlEncode(value) {

  return Buffer
    .from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function base64UrlDecode(value) {

  const padded =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  return Buffer
    .from(
      padded + "=".repeat(
        (4 - padded.length % 4) % 4
      ),
      "base64"
    )
    .toString("utf8");
}


function createToken(payload) {

  const data = base64UrlEncode(
    JSON.stringify(payload)
  );

  const signature = crypto
    .createHmac(
      "sha256",
      SESSION_SECRET
    )
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${data}.${signature}`;
}


function verifyToken(token) {

  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [data, signature] = parts;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        SESSION_SECRET
      )
      .update(data)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  try {

    const a =
      Buffer.from(signature);

    const b =
      Buffer.from(expectedSignature);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

  } catch {

    return null;
  }

  try {

    const payload =
      JSON.parse(
        base64UrlDecode(data)
      );

    if (
      !payload.exp ||
      Date.now() > payload.exp
    ) {
      return null;
    }

    return payload;

  } catch {

    return null;
  }
}


function createUserToken(user) {

  return createToken({

    type: "user",

    userId: user.id,

    exp:
      Date.now() +
      SESSION_DAYS *
      24 *
      60 *
      60 *
      1000

  });

}


function createAdminToken() {

  return createToken({

    type: "admin",

    exp:
      Date.now() +
      SESSION_DAYS *
      24 *
      60 *
      60 *
      1000

  });

}


function createOrderAccessToken(orderId) {

  return createToken({

    type: "order",

    orderId,

    exp:
      Date.now() +
      ORDER_ACCESS_DAYS *
      24 *
      60 *
      60 *
      1000

  });

}


/* =========================================================
   AUTHORIZATION HELPERS
========================================================= */

function getBearerToken(req) {

  const header =
    req.headers.authorization;

  if (
    !header ||
    !header.startsWith("Bearer ")
  ) {
    return null;
  }

  return header.substring(7).trim();
}


function requireUser(req, res, next) {

  const token =
    getBearerToken(req);

  const payload =
    verifyToken(token);

  if (
    !payload ||
    payload.type !== "user" ||
    !payload.userId
  ) {

    return res.status(401).json({
      error:
        "Authentication required."
    });

  }

  const user =
    db.prepare(
      `SELECT
        id,
        name,
        email,
        phone,
        created_at
       FROM users
       WHERE id=?`
    ).get(payload.userId);

  if (!user) {

    return res.status(401).json({
      error:
        "Account no longer exists."
    });

  }

  req.user = user;

  next();

}


function requireAdmin(req, res, next) {

  const token =
    getBearerToken(req);

  const payload =
    verifyToken(token);

  if (
    payload &&
    payload.type === "admin"
  ) {

    req.admin = true;

    return next();
  }

  return res.status(401).json({
    error:
      "Admin authentication required."
  });

}


/*
  Allows the order owner to access the order.

  It also allows a guest customer to use the
  private order-access token returned after checkout.
*/

function requireOrderAccess(req, res, next) {

  const orderId =
    Number(req.params.id);

  if (
    !Number.isInteger(orderId) ||
    orderId <= 0
  ) {

    return res.status(400).json({
      error: "Invalid order ID."
    });

  }

  const order =
    db.prepare(
      "SELECT * FROM orders WHERE id=?"
    ).get(orderId);

  if (!order) {

    return res.status(404).json({
      error: "Order not found."
    });

  }

  /* ADMIN */

  const bearer =
    getBearerToken(req);

  const payload =
    verifyToken(bearer);

  if (
    payload &&
    payload.type === "admin"
  ) {

    req.order = order;

    return next();
  }


  /* LOGGED-IN CUSTOMER */

  if (
    payload &&
    payload.type === "user" &&
    payload.userId &&
    order.user_id === payload.userId
  ) {

    req.order = order;

    return next();
  }


  /* GUEST ORDER ACCESS TOKEN */

  if (
    payload &&
    payload.type === "order" &&
    Number(payload.orderId) === orderId
  ) {

    req.order = order;

    return next();
  }


  return res.status(403).json({
    error:
      "You do not have access to this order."
  });

}

/* =========================================================
   BASIC ROUTES
========================================================= */

app.get("/", (req, res) => {

  res.json({

    ok: true,

    service:
      "ZEVORIA API",

    message:
      "Backend is running"

  });

});


app.get("/api/health", (req, res) => {

  res.json({

    ok: true,

    service:
      "ZEVORIA API"

  });

});


app.get("/api/products", (req, res) => {

  res.json(
    db.prepare(
      `SELECT
        id,
        name,
        category,
        price,
        stock,
        note
       FROM products
       ORDER BY id ASC`
    ).all()
  );

});

/* =========================================================
   SIGN UP
========================================================= */

const signupSchema = z.object({

  name:
    z.string()
      .trim()
      .min(2)
      .max(80),

  email:
    z.string()
      .email()
      .max(120),

  phone:
    z.string()
      .trim()
      .min(8)
      .max(20),

  password:
    z.string()
      .min(6)
      .max(100)

});


app.post(
  "/api/auth/signup",
  authRateLimit,
  async (req, res) => {

    const parsed =
      signupSchema.safeParse(req.body);

    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Please enter valid details and a password of at least 6 characters."
      });

    }

    const {
      name,
      email,
      phone,
      password
    } = parsed.data;

    const normalizedEmail =
      email.toLowerCase().trim();

    try {

      const existing =
        db.prepare(
          "SELECT id FROM users WHERE email=?"
        ).get(normalizedEmail);

      if (existing) {

        return res.status(409).json({
          error:
            "An account with this email already exists."
        });

      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const info =
        db.prepare(
          `INSERT INTO users
          (name,email,phone,password_hash,created_at)
          VALUES(?,?,?,?,datetime('now'))`
        ).run(
          name.trim(),
          normalizedEmail,
          phone.trim(),
          passwordHash
        );

      const user =
        db.prepare(
          `SELECT
            id,
            name,
            email,
            phone,
            created_at
           FROM users
           WHERE id=?`
        ).get(
          info.lastInsertRowid
        );

      const token =
        createUserToken(user);

      res.status(201).json({

        message:
          "Account created successfully",

        token,

        user

      });

    } catch (err) {

      console.error(
        "Signup error:",
        err
      );

      res.status(500).json({
        error:
          "Could not create account"
      });

    }

  }
);

/* =========================================================
   LOGIN
========================================================= */

const loginSchema = z.object({

  email:
    z.string()
      .email()
      .max(120),

  password:
    z.string()
      .min(1)
      .max(100)

});


app.post(
  "/api/auth/login",
  authRateLimit,
  async (req, res) => {

    const parsed =
      loginSchema.safeParse(req.body);

    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Please enter a valid email and password."
      });

    }

    const {
      email,
      password
    } = parsed.data;

    const normalizedEmail =
      email.toLowerCase().trim();

    const user =
      db.prepare(
        "SELECT * FROM users WHERE email=?"
      ).get(normalizedEmail);

    if (!user) {

      return res.status(401).json({
        error:
          "Invalid email or password."
      });

    }

    const valid =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!valid) {

      return res.status(401).json({
        error:
          "Invalid email or password."
      });

    }

    const safeUser = {

      id: user.id,

      name: user.name,

      email: user.email,

      phone: user.phone,

      created_at:
        user.created_at

    };

    const token =
      createUserToken(
        safeUser
      );

    res.json({

      message:
        "Login successful",

      token,

      user:
        safeUser

    });

  }
);

/* =========================================================
   CURRENT CUSTOMER
========================================================= */

app.get(
  "/api/auth/me",
  requireUser,
  (req, res) => {

    res.json({
      user: req.user
    });

  }
);

/* =========================================================
   CUSTOMER LOGOUT
========================================================= */

app.post(
  "/api/auth/logout",
  requireUser,
  (req, res) => {

    /*
      Tokens are stateless.

      The frontend removes its token.
      Expiration also automatically invalidates
      the token after the session period.
    */

    res.json({
      message:
        "Logged out successfully"
    });

  }
);

/* =========================================================
   CUSTOMER ORDER HISTORY
========================================================= */

app.get(
  "/api/account/orders",
  requireUser,
  (req, res) => {

    const orders =
      db.prepare(
        `SELECT
          id,
          customer_name,
          customer_email,
          phone,
          address,
          total,
          status,
          created_at
         FROM orders
         WHERE user_id=?
         ORDER BY id DESC`
      ).all(req.user.id);

    for (const order of orders) {

      order.items =
        db.prepare(
          `SELECT
            product_id,
            name,
            qty,
            price
           FROM order_items
           WHERE order_id=?`
        ).all(order.id);

    }

    res.json({
      orders
    });

  }
);

/* =========================================================
   ORDER EMAIL
========================================================= */

async function sendOrderConfirmationEmail({
  email,
  customerName,
  orderId,
  items,
  total,
  address
}) {

  if (!resend) {

    console.log(
      "Resend is not configured. Email skipped."
    );

    return false;

  }

  if (!email) {

    console.log(
      "No customer email supplied. Email skipped."
    );

    return false;

  }

  const itemRows =
    items.map(item => {

      const itemTotal =
        item.price * item.qty;

      return `
        <tr>
          <td style="
            padding:14px 10px;
            border-bottom:1px solid #292929;
            color:#ffffff;
            font-size:14px;
          ">
            ${escapeHtml(item.name)}
          </td>

          <td style="
            padding:14px 10px;
            border-bottom:1px solid #292929;
            color:#cccccc;
            text-align:center;
          ">
            ${item.qty}
          </td>

          <td style="
            padding:14px 10px;
            border-bottom:1px solid #292929;
            color:#d4af37;
            text-align:right;
          ">
            ₹${itemTotal.toLocaleString("en-IN")}
          </td>
        </tr>
      `;

    }).join("");

  const html = `

  <!DOCTYPE html>

  <html>

  <head>

    <meta charset="UTF-8">

    <meta name="viewport"
      content="width=device-width, initial-scale=1.0">

    <title>ZEVORIA Order Confirmation</title>

  </head>

  <body style="
    margin:0;
    padding:0;
    background:#0a0a0a;
    font-family:Arial,Helvetica,sans-serif;
    color:#ffffff;
  ">

    <div style="
      max-width:650px;
      margin:0 auto;
      background:#111111;
    ">

      <div style="
        padding:35px 25px;
        text-align:center;
        border-bottom:1px solid #292929;
      ">

        <div style="
          font-size:32px;
          font-weight:bold;
          letter-spacing:6px;
          color:#d4af37;
        ">
          ZEVORIA
        </div>

        <div style="
          margin-top:8px;
          color:#999999;
          font-size:12px;
          letter-spacing:3px;
        ">
          THE ART OF FRAGRANCE
        </div>

      </div>

      <div style="
        padding:40px 25px 20px;
        text-align:center;
      ">

        <div style="
          display:inline-block;
          width:55px;
          height:55px;
          line-height:55px;
          border-radius:50%;
          background:#d4af37;
          color:#111111;
          font-size:28px;
          font-weight:bold;
        ">
          ✓
        </div>

        <h1 style="
          margin:20px 0 8px;
          color:#ffffff;
          font-size:26px;
        ">
          Order Confirmed
        </h1>

        <p style="
          margin:0;
          color:#aaaaaa;
          font-size:15px;
        ">
          Thank you for choosing ZEVORIA.
        </p>

      </div>

      <div style="
        margin:20px 25px;
        padding:20px;
        background:#181818;
        border:1px solid #292929;
        text-align:center;
      ">

        <div style="
          color:#888888;
          font-size:11px;
          letter-spacing:2px;
          text-transform:uppercase;
        ">
          Order Number
        </div>

        <div style="
          margin-top:8px;
          color:#d4af37;
          font-size:24px;
          font-weight:bold;
        ">
          #${orderId}
        </div>

      </div>

      <div style="
        padding:10px 25px 25px;
      ">

        <p style="
          color:#ffffff;
          font-size:16px;
        ">
          Hello ${escapeHtml(customerName)},
        </p>

        <p style="
          color:#aaaaaa;
          line-height:1.7;
          font-size:14px;
        ">
          Your order has been successfully received.
          We are preparing your fragrance collection
          for delivery.
        </p>

      </div>

      <div style="
        padding:0 25px;
      ">

        <h2 style="
          color:#d4af37;
          font-size:16px;
          letter-spacing:1px;
        ">
          ORDER DETAILS
        </h2>

        <table style="
          width:100%;
          border-collapse:collapse;
        ">

          <thead>

            <tr>

              <th style="
                padding:12px 10px;
                text-align:left;
                color:#888888;
                font-size:11px;
              ">
                PRODUCT
              </th>

              <th style="
                padding:12px 10px;
                text-align:center;
                color:#888888;
                font-size:11px;
              ">
                QTY
              </th>

              <th style="
                padding:12px 10px;
                text-align:right;
                color:#888888;
                font-size:11px;
              ">
                TOTAL
              </th>

            </tr>

          </thead>

          <tbody>

            ${itemRows}

          </tbody>

        </table>

      </div>

      <div style="
        margin:25px;
        padding:20px;
        background:#181818;
        border:1px solid #292929;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
        ">

          <span style="
            color:#aaaaaa;
            font-size:14px;
          ">
            Order Total
          </span>

          <span style="
            color:#d4af37;
            font-size:24px;
            font-weight:bold;
          ">
            ₹${total.toLocaleString("en-IN")}
          </span>

        </div>

      </div>

      <div style="
        padding:0 25px 30px;
      ">

        <h2 style="
          color:#d4af37;
          font-size:16px;
          letter-spacing:1px;
        ">
          DELIVERY ADDRESS
        </h2>

        <div style="
          padding:16px;
          background:#181818;
          color:#cccccc;
          line-height:1.6;
          font-size:14px;
        ">
          ${escapeHtml(address)}
        </div>

      </div>

      <div style="
        padding:30px 25px;
        background:#090909;
        border-top:1px solid #292929;
        text-align:center;
      ">

        <div style="
          color:#d4af37;
          font-size:18px;
          font-weight:bold;
          letter-spacing:4px;
        ">
          ZEVORIA
        </div>

        <p style="
          color:#777777;
          font-size:12px;
        ">
          Crafted for those who leave an impression.
        </p>

      </div>

    </div>

  </body>

  </html>

  `;

  try {

    const result =
      await resend.emails.send({

        from:
          EMAIL_FROM,

        to: [email],

        subject:
          `ZEVORIA Order Confirmed — #${orderId}`,

        html

      });

    console.log(
      "Order confirmation email sent:",
      result
    );

    return true;

  } catch (err) {

    console.error(
      "Resend email error:",
      err
    );

    return false;

  }

}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

/* =========================================================
   CREATE ORDER
========================================================= */

const orderSchema = z.object({

  customerName:
    z.string()
      .trim()
      .min(2)
      .max(80),

  customerEmail:
    z.string()
      .email()
      .max(120)
      .optional()
      .or(z.literal("")),

  phone:
    z.string()
      .trim()
      .min(8)
      .max(20),

  address:
    z.string()
      .trim()
      .min(5)
      .max(300),

  items:
    z.array(
      z.object({

        productId:
          z.number()
            .int()
            .positive(),

        qty:
          z.number()
            .int()
            .min(1)
            .max(20)

      })
    )
    .min(1)
    .max(20)

});


app.post(
  "/api/orders",
  orderRateLimit,
  async (req, res) => {

    const parsed =
      orderSchema.safeParse(req.body);

    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Invalid order details."
      });

    }

    const {
      customerName,
      customerEmail,
      phone,
      address,
      items
    } = parsed.data;

    /*
      If the customer is logged in,
      attach the order to their account.
    */

    let userId = null;

    const token =
      getBearerToken(req);

    const payload =
      verifyToken(token);

    if (
      payload &&
      payload.type === "user"
    ) {

      userId =
        Number(payload.userId);

    }

    const getProduct =
      db.prepare(
        "SELECT * FROM products WHERE id=?"
      );

    let total = 0;

    const lines = [];

    /*
      Server-side price calculation.
      Browser price is completely ignored.
    */

    for (const item of items) {

      const product =
        getProduct.get(
          item.productId
        );

      if (!product) {

        return res.status(400).json({
          error:
            "Product not found."
        });

      }

      if (
        product.stock <
        item.qty
      ) {

        return res.status(409).json({
          error:
            `Insufficient stock for ${product.name}`
        });

      }

      total +=
        product.price *
        item.qty;

      lines.push({

        productId:
          item.productId,

        qty:
          item.qty,

        product

      });

    }

    /*
      Prevent duplicate product IDs
      from being used to manipulate stock.
    */

    const productIds =
      lines.map(x => x.productId);

    if (
      new Set(productIds).size !==
      productIds.length
    ) {

      return res.status(400).json({
        error:
          "Duplicate products are not allowed in an order."
      });

    }

    let orderId;

    try {

      const transaction =
        db.transaction(() => {

          const info =
            db.prepare(
              `INSERT INTO orders
              (
                user_id,
                customer_name,
                customer_email,
                phone,
                address,
                total,
                status,
                created_at
              )
              VALUES(?,?,?,?,?,?,?,datetime('now'))`
            ).run(

              userId,

              customerName,

              customerEmail || null,

              phone,

              address,

              total,

              "pending"

            );

          const newOrderId =
            info.lastInsertRowid;

          for (const line of lines) {

            db.prepare(
              `INSERT INTO order_items
              (
                order_id,
                product_id,
                name,
                qty,
                price
              )
              VALUES(?,?,?,?,?)`
            ).run(

              newOrderId,

              line.product.id,

              line.product.name,

              line.qty,

              line.product.price

            );

            const stockUpdate =
              db.prepare(
                `UPDATE products
                 SET stock=stock-?
                 WHERE id=?
                 AND stock>=?`
              ).run(
                line.qty,
                line.product.id,
                line.qty
              );

            if (
              stockUpdate.changes !== 1
            ) {

              throw new Error(
                `Stock changed for ${line.product.name}.`
              );

            }

          }

          return newOrderId;

        });

      orderId =
        transaction();

    } catch (err) {

      console.error(
        "Order transaction error:",
        err
      );

      return res.status(409).json({
        error:
          "The order could not be completed. Please try again."
      });

    }

    /*
      Private token for guest order tracking.
    */

    const orderAccessToken =
      createOrderAccessToken(
        orderId
      );

    let emailSent = false;

    if (customerEmail) {

      emailSent =
        await sendOrderConfirmationEmail({

          email:
            customerEmail,

          customerName,

          orderId,

          items:
            lines.map(x => ({

              name:
                x.product.name,

              qty:
                x.qty,

              price:
                x.product.price

            })),

          total,

          address

        });

    }

    res.status(201).json({

      orderId,

      total,

      emailSent,

      orderAccessToken,

      status:
        "pending"

    });

  }
);

/* =========================================================
   SECURE ORDER DETAILS
========================================================= */

app.get(
  "/api/orders/:id",
  requireOrderAccess,
  (req, res) => {

    const order =
      req.order;

    const items =
      db.prepare(
        `SELECT
          product_id,
          name,
          qty,
          price
         FROM order_items
         WHERE order_id=?`
      ).all(order.id);

    res.json({

      order,

      items

    });

  }
);

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  adminLoginRateLimit,
  (req, res) => {

    const schema =
      z.object({

        key:
          z.string()
            .min(1)
            .max(200)

      });

    const parsed =
      schema.safeParse(req.body);

    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Admin key is required."
      });

    }

    if (
      !process.env.ADMIN_KEY
    ) {

      return res.status(500).json({
        error:
          "Admin authentication is not configured."
      });

    }

    const suppliedKey =
      parsed.data.key;

    const expectedKey =
      process.env.ADMIN_KEY;

    const suppliedBuffer =
      Buffer.from(suppliedKey);

    const expectedBuffer =
      Buffer.from(expectedKey);

    let valid = false;

    if (
      suppliedBuffer.length ===
      expectedBuffer.length
    ) {

      valid =
        crypto.timingSafeEqual(
          suppliedBuffer,
          expectedBuffer
        );

    }

    if (!valid) {

      return res.status(401).json({
        error:
          "Invalid admin credentials."
      });

    }

    const token =
      createAdminToken();

    res.json({

      message:
        "Admin login successful",

      token,

      expiresIn:
        SESSION_DAYS *
        24 *
        60 *
        60

    });

  }
);

/* =========================================================
   ADMIN - CHECK ACCESS
========================================================= */

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {

    res.json({

      authenticated:
        true,

      role:
        "admin"

    });

  }
);

/* =========================================================
   ADMIN - ALL ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  (req, res) => {

    const orders =
      db.prepare(
        `SELECT
          o.id,
          o.user_id,
          o.customer_name,
          o.customer_email,
          o.phone,
          o.address,
          o.total,
          o.status,
          o.created_at
         FROM orders o
         ORDER BY o.id DESC`
      ).all();

    for (const order of orders) {

      order.items =
        db.prepare(
          `SELECT
            product_id,
            name,
            qty,
            price
           FROM order_items
           WHERE order_id=?`
        ).all(order.id);

    }

    res.json(orders);

  }
);

/* =========================================================
   ADMIN - UPDATE ORDER STATUS
========================================================= */

const statusSchema = z.object({

  status:
    z.enum([
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled"
    ])

});


app.patch(
  "/api/admin/orders/:id/status",
  requireAdmin,
  (req, res) => {

    const parsed =
      statusSchema.safeParse(req.body);

    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Invalid order status."
      });

    }

    const orderId =
      Number(req.params.id);

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {

      return res.status(400).json({
        error:
          "Invalid order ID."
      });

    }

    const existing =
      db.prepare(
        "SELECT id FROM orders WHERE id=?"
      ).get(orderId);

    if (!existing) {

      return res.status(404).json({
        error:
          "Order not found."
      });

    }

    db.prepare(
      `UPDATE orders
       SET status=?
       WHERE id=?`
    ).run(
      parsed.data.status,
      orderId
    );

    const updated =
      db.prepare(
        "SELECT * FROM orders WHERE id=?"
      ).get(orderId);

    res.json({

      message:
        "Order status updated",

      order:
        updated

    });

  }
);

/* =========================================================
   ADMIN - PRODUCTS
========================================================= */

app.get(
  "/api/admin/products",
  requireAdmin,
  (req, res) => {

    const products =
      db.prepare(
        `SELECT *
         FROM products
         ORDER BY id ASC`
      ).all();

    res.json({
      products
    });

  }
);

/* =========================================================
   ADMIN - UPDATE STOCK
========================================================= */

const stockSchema = z.object({

  stock:
    z.number()
      .int()
      .min(0)
      .max(100000)

});


app.patch(
  "/api/admin/products/:id/stock",
  requireAdmin,
  (req, res) => {

    const parsed =
      stockSchema.safeParse(req.body);

    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Invalid stock value."
      });

    }

    const productId =
      Number(req.params.id);

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {

      return res.status(400).json({
        error:
          "Invalid product ID."
      });

    }

    const product =
      db.prepare(
        "SELECT id,name FROM products WHERE id=?"
      ).get(productId);

    if (!product) {

      return res.status(404).json({
        error:
          "Product not found."
      });

    }

    db.prepare(
      `UPDATE products
       SET stock=?
       WHERE id=?`
    ).run(
      parsed.data.stock,
      productId
    );

    const updated =
      db.prepare(
        "SELECT * FROM products WHERE id=?"
      ).get(productId);

    res.json({

      message:
        "Stock updated",

      product:
        updated

    });

  }
);

/* =========================================================
   ADMIN - LOW STOCK
========================================================= */

app.get(
  "/api/admin/low-stock",
  requireAdmin,
  (req, res) => {

    const products =
      db.prepare(
        `SELECT *
         FROM products
         WHERE stock <= 5
         ORDER BY stock ASC`
      ).all();

    res.json({
      products
    });

  }
);

/* =========================================================
   ADMIN - DASHBOARD STATS
========================================================= */

app.get(
  "/api/admin/stats",
  requireAdmin,
  (req, res) => {

    const totalOrders =
      db.prepare(
        `SELECT COUNT(*) AS count
         FROM orders`
      ).get().count;

    const totalSales =
      db.prepare(
        `SELECT
          COALESCE(SUM(total),0) AS total
         FROM orders
         WHERE status != 'cancelled'`
      ).get().total;

    const pendingOrders =
      db.prepare(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status='pending'`
      ).get().count;

    const confirmedOrders =
      db.prepare(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status='confirmed'`
      ).get().count;

    const shippedOrders =
      db.prepare(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status='shipped'`
      ).get().count;

    const deliveredOrders =
      db.prepare(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status='delivered'`
      ).get().count;

    const cancelledOrders =
      db.prepare(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status='cancelled'`
      ).get().count;

    res.json({

      totalOrders,

      totalSales,

      pendingOrders,

      confirmedOrders,

      shippedOrders,

      deliveredOrders,

      cancelledOrders

    });

  }
);

/* =========================================================
   DEMO OTP DISABLED
========================================================= */

/*
  IMPORTANT:

  The old OTP system returned the OTP directly
  to the browser. That is NOT secure.

  It is intentionally disabled until a real
  SMS/OTP provider is connected.
*/

app.post(
  "/api/auth/send-otp",
  (req, res) => {

    res.status(410).json({

      error:
        "OTP login is temporarily disabled. Please use email and password login."

    });

  }
);


app.post(
  "/api/auth/verify-otp",
  (req, res) => {

    res.status(410).json({

      error:
        "OTP login is temporarily disabled. Please use email and password login."

    });

  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({

      error:
        "Endpoint not found."

    });

  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (err, req, res, next) => {

    console.error(
      "Server error:",
      err
    );

    if (
      err.message ===
      "CORS: origin not allowed"
    ) {

      return res.status(403).json({
        error:
          "Origin not allowed."
      });

    }

    res.status(500).json({

      error:
        "Internal server error."

    });

  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `ZEVORIA API running on port ${PORT}`
    );

  }
);

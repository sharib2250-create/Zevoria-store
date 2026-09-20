require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { Resend } = require("resend");

const app = express();

app.set("trust proxy", 1);

const db = new Database("zevoria.db");

/* =========================
   RESEND EMAIL
========================= */

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || "onboarding@resend.dev";


/* =========================
   CORS
========================= */

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

    return callback(new Error("CORS: origin not allowed"));
  }
}));

app.use(express.json({ limit: "100kb" }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));


/* =========================
   DATABASE
========================= */

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


/* =========================
   DATABASE MIGRATION
   Adds email to old orders
========================= */

try {
  const columns = db.prepare(
    "PRAGMA table_info(orders)"
  ).all();

  const hasEmailColumn = columns.some(
    column => column.name === "customer_email"
  );

  if (!hasEmailColumn) {
    db.exec(
      "ALTER TABLE orders ADD COLUMN customer_email TEXT"
    );

    console.log("Added customer_email column to orders");
  }

} catch (err) {
  console.error(
    "Order email migration error:",
    err
  );
}


/* =========================
   PRODUCTS
========================= */

const seedProducts = [
  [1, "No. 01 Noir", "men", 1499, 25, "Amber • Oud • Vanilla"],
  [2, "No. 02 Santal", "unisex", 1699, 25, "Sandalwood • Musk • Cedar"],
  [3, "No. 03 Bloom", "women", 1399, 25, "Rose • Peony • Vanilla"],
  [4, "No. 04 Oud", "unisex", 899, 25, "Oud • Saffron • Amber"],
  [5, "No. 05 Azure", "men", 1599, 25, "Bergamot • Marine • Musk"],
  [6, "No. 06 Velvet", "women", 1499, 25, "Iris • Tonka • Amber"]
];

const insertProduct = db.prepare(
  "INSERT OR IGNORE INTO products(id,name,category,price,stock,note) VALUES (?,?,?,?,?,?)"
);

for (const p of seedProducts) {
  insertProduct.run(...p);
}


/* =========================
   BASIC ROUTES
========================= */

app.get("/", (req, res) => {

  res.json({
    ok: true,
    service: "ZEVORIA API",
    message: "Backend is running"
  });

});


app.get("/api/health", (req, res) => {

  res.json({
    ok: true,
    service: "ZEVORIA API"
  });

});


app.get("/api/products", (req, res) => {

  res.json(
    db.prepare(
      "SELECT * FROM products ORDER BY id ASC"
    ).all()
  );

});


/* =========================
   SIGN UP
========================= */

const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  phone: z.string().min(8).max(20),
  password: z.string().min(6).max(100)
});


app.post("/api/auth/signup", async (req, res) => {

  const parsed = signupSchema.safeParse(req.body);

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

    const existing = db.prepare(
      "SELECT id FROM users WHERE email=?"
    ).get(normalizedEmail);

    if (existing) {

      return res.status(409).json({
        error:
          "An account with this email already exists."
      });

    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const info = db.prepare(
      `INSERT INTO users
      (name,email,phone,password_hash,created_at)
      VALUES(?,?,?,?,datetime('now'))`
    ).run(
      name.trim(),
      normalizedEmail,
      phone.trim(),
      passwordHash
    );

    const user = db.prepare(
      `SELECT id,name,email,phone,created_at
       FROM users
       WHERE id=?`
    ).get(info.lastInsertRowid);

    res.status(201).json({
      message: "Account created successfully",
      user
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Could not create account"
    });

  }

});


/* =========================
   SIGN IN
========================= */

const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(100)
});


app.post("/api/auth/login", async (req, res) => {

  const parsed = loginSchema.safeParse(req.body);

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

  const user = db.prepare(
    "SELECT * FROM users WHERE email=?"
  ).get(
    email.toLowerCase().trim()
  );

  if (!user) {

    return res.status(401).json({
      error: "Invalid email or password."
    });

  }

  const valid = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!valid) {

    return res.status(401).json({
      error: "Invalid email or password."
    });

  }

  res.json({
    message: "Login successful",

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at
    }
  });

});


/* =========================
   ORDER EMAIL FUNCTION
========================= */

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

    return;

  }

  if (!email) {

    console.log(
      "No customer email supplied. Email skipped."
    );

    return;

  }

  const itemRows = items.map(item => {

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
          ${item.name}
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

      <!-- HEADER -->

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


      <!-- SUCCESS -->

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


      <!-- ORDER NUMBER -->

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


      <!-- CUSTOMER -->

      <div style="
        padding:10px 25px 25px;
      ">

        <p style="
          color:#ffffff;
          font-size:16px;
        ">
          Hello ${customerName},
        </p>

        <p style="
          color:#aaaaaa;
          line-height:1.7;
          font-size:14px;
        ">
          Your order has been successfully received.
          We are preparing your fragrance collection
          for the next stage of delivery.
        </p>

      </div>


      <!-- PRODUCTS -->

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
                letter-spacing:1px;
              ">
                PRODUCT
              </th>

              <th style="
                padding:12px 10px;
                text-align:center;
                color:#888888;
                font-size:11px;
                letter-spacing:1px;
              ">
                QTY
              </th>

              <th style="
                padding:12px 10px;
                text-align:right;
                color:#888888;
                font-size:11px;
                letter-spacing:1px;
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


      <!-- TOTAL -->

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


      <!-- DELIVERY -->

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
          ${address}
        </div>

      </div>


      <!-- FOOTER -->

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
          margin:12px 0;
        ">
          Crafted for those who leave an impression.
        </p>

        <p style="
          color:#555555;
          font-size:11px;
        ">
          This is an automated order confirmation email.
        </p>

      </div>

    </div>

  </body>

  </html>

  `;


  try {

    const result = await resend.emails.send({

      from: EMAIL_FROM,

      to: [email],

      subject:
        `ZEVORIA Order Confirmed — #${orderId}`,

      html

    });

    console.log(
      "Order confirmation email sent:",
      result
    );

  } catch (err) {

    console.error(
      "Resend email error:",
      err
    );

  }

}


/* =========================
   CREATE ORDER
========================= */

const orderSchema = z.object({

  customerName:
    z.string().min(2).max(80),

  customerEmail:
    z.string().email().max(120).optional(),

  phone:
    z.string().min(8).max(20),

  address:
    z.string().min(5).max(300),

  items:
    z.array(
      z.object({
        productId:
          z.number().int().positive(),

        qty:
          z.number().int().min(1).max(20)
      })
    ).min(1)

});


app.post("/api/orders", async (req, res) => {

  const parsed =
    orderSchema.safeParse(req.body);

  if (!parsed.success) {

    return res.status(400).json({
      error: "Invalid order details"
    });

  }

  const {
    customerName,
    customerEmail,
    phone,
    address,
    items
  } = parsed.data;


  const get = db.prepare(
    "SELECT * FROM products WHERE id=?"
  );


  let total = 0;

  let lines = [];


  for (const item of items) {

    const p = get.get(
      item.productId
    );


    if (!p) {

      return res.status(400).json({
        error: "Product not found"
      });

    }


    if (p.stock < item.qty) {

      return res.status(409).json({
        error:
          `Insufficient stock for ${p.name}`
      });

    }


    total +=
      p.price * item.qty;


    lines.push({
      ...item,
      p
    });

  }


  const tx =
    db.transaction(() => {

      const info =
        db.prepare(
          `INSERT INTO orders
          (customer_name,customer_email,phone,address,total,status,created_at)
          VALUES(?,?,?,?,?,?,datetime('now'))`
        ).run(
          customerName,
          customerEmail || null,
          phone,
          address,
          total,
          "pending"
        );


      for (const x of lines) {

        db.prepare(
          `INSERT INTO order_items
          (order_id,product_id,name,qty,price)
          VALUES(?,?,?,?,?)`
        ).run(
          info.lastInsertRowid,
          x.p.id,
          x.p.name,
          x.qty,
          x.p.price
        );


        db.prepare(
          "UPDATE products SET stock=stock-? WHERE id=?"
        ).run(
          x.qty,
          x.p.id
        );

      }


      return info.lastInsertRowid;

    });


  const orderId = tx();


  /* =========================
     SEND CONFIRMATION EMAIL
  ========================= */

  if (customerEmail) {

    await sendOrderConfirmationEmail({

      email: customerEmail,

      customerName,

      orderId,

      items: lines.map(x => ({
        name: x.p.name,
        qty: x.qty,
        price: x.p.price
      })),

      total,

      address

    });

  }


  res.status(201).json({

    orderId,

    total,

    emailSent:
      Boolean(customerEmail && resend)

  });

});


/* =========================
   CUSTOMER ORDER DETAILS
========================= */

app.get("/api/orders/:id", (req, res) => {

  const o = db.prepare(
    "SELECT * FROM orders WHERE id=?"
  ).get(req.params.id);


  if (!o) {

    return res.status(404).json({
      error: "Order not found"
    });

  }


  o.items = db.prepare(
    `SELECT
      product_id,
      name,
      qty,
      price
     FROM order_items
     WHERE order_id=?`
  ).all(o.id);


  res.json(o);

});


/* =========================
   ADMIN AUTH CHECK
========================= */

function requireAdmin(req, res, next) {

  if (
    !process.env.ADMIN_KEY ||
    req.headers["x-admin-key"] !==
      process.env.ADMIN_KEY
  ) {

    return res.status(401).json({
      error: "Unauthorized"
    });

  }

  next();

}


/* =========================
   ADMIN - ALL ORDERS
========================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  (req, res) => {

    const orders =
      db.prepare(`
        SELECT
          o.id,
          o.customer_name,
          o.customer_email,
          o.phone,
          o.address,
          o.total,
          o.status,
          o.created_at
        FROM orders o
        ORDER BY o.id DESC
      `).all();


    for (const order of orders) {

      order.items =
        db.prepare(`
          SELECT
            product_id,
            name,
            qty,
            price
          FROM order_items
          WHERE order_id=?
        `).all(order.id);

    }


    res.json(orders);

  }
);


/* =========================
   ADMIN - UPDATE STATUS
========================= */

const statusSchema = z.object({

  status: z.enum([
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
        error: "Invalid order status"
      });

    }


    const orderId =
      Number(req.params.id);


    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {

      return res.status(400).json({
        error: "Invalid order ID"
      });

    }


    const existing =
      db.prepare(
        "SELECT id FROM orders WHERE id=?"
      ).get(orderId);


    if (!existing) {

      return res.status(404).json({
        error: "Order not found"
      });

    }


    db.prepare(
      "UPDATE orders SET status=? WHERE id=?"
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

      order: updated

    });

  }
);


/* =========================
   ADMIN - DASHBOARD STATS
========================= */

app.get(
  "/api/admin/stats",
  requireAdmin,
  (req, res) => {

    const totalOrders =
      db.prepare(
        "SELECT COUNT(*) AS count FROM orders"
      ).get().count;


    const totalSales =
      db.prepare(
        `SELECT COALESCE(SUM(total),0) AS total
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


/* =========================
   DEMO OTP SYSTEM
========================= */

const otpStore = new Map();


function generateOTP() {

  return String(
    Math.floor(
      100000 +
      Math.random() * 900000
    )
  );

}


const otpSendSchema = z.object({

  phone:
    z.string().min(8).max(20)

});


app.post(
  "/api/auth/send-otp",
  (req, res) => {

    const parsed =
      otpSendSchema.safeParse(req.body);


    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Please enter a valid mobile number."
      });

    }


    const phone =
      parsed.data.phone.trim();


    const otp =
      generateOTP();


    otpStore.set(
      phone,
      {
        otp,
        expiresAt:
          Date.now() + 5 * 60 * 1000
      }
    );


    console.log(
      `Demo OTP for ${phone}: ${otp}`
    );


    res.json({

      message:
        "OTP generated successfully",

      demoOtp:
        otp

    });

  }
);


const otpVerifySchema = z.object({

  phone:
    z.string().min(8).max(20),

  otp:
    z.string().length(6)

});


app.post(
  "/api/auth/verify-otp",
  (req, res) => {

    const parsed =
      otpVerifySchema.safeParse(req.body);


    if (!parsed.success) {

      return res.status(400).json({
        error:
          "Invalid OTP details."
      });

    }


    const {
      phone,
      otp
    } = parsed.data;


    const saved =
      otpStore.get(phone);


    if (!saved) {

      return res.status(400).json({
        error:
          "OTP not found. Please request a new OTP."
      });

    }


    if (
      Date.now() >
      saved.expiresAt
    ) {

      otpStore.delete(phone);

      return res.status(400).json({
        error:
          "OTP expired. Please request a new OTP."
      });

    }


    if (saved.otp !== otp) {

      return res.status(400).json({
        error:
          "Incorrect OTP."
      });

    }


    otpStore.set(
      phone,
      {
        verified: true,
        expiresAt:
          Date.now() + 10 * 60 * 1000
      }
    );


    res.json({

      message:
        "Mobile number verified successfully",

      verified:
        true

    });

  }
);


/* =========================
   START SERVER
========================= */

app.listen(
  process.env.PORT || 4000,
  () => {

    console.log(
      "ZEVORIA API running"
    );

  }
);

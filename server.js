require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const app=express();

app.set("trust proxy", 1);

const db=new Database("zevoria.db");

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
    db.prepare("SELECT * FROM products ORDER BY id ASC").all()
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
      error: "Please enter valid details and a password of at least 6 characters."
    });
  }

  const {
    name,
    email,
    phone,
    password
  } = parsed.data;

  const normalizedEmail = email.toLowerCase().trim();

  try {

    const existing = db.prepare(
      "SELECT id FROM users WHERE email=?"
    ).get(normalizedEmail);

    if (existing) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const info = db.prepare(
      "INSERT INTO users(name,email,phone,password_hash,created_at) VALUES(?,?,?,?,datetime('now'))"
    ).run(
      name.trim(),
      normalizedEmail,
      phone.trim(),
      passwordHash
    );

    const user = db.prepare(
      "SELECT id,name,email,phone,created_at FROM users WHERE id=?"
    ).get(info.lastInsertRowid);

    res.status(201).json({
      message: "Account created successfully",
      user
    });

  } catch (err) {

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
      error: "Please enter a valid email and password."
    });
  }

  const {
    email,
    password
  } = parsed.data;

  const user = db.prepare(
    "SELECT * FROM users WHERE email=?"
  ).get(email.toLowerCase().trim());

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
   ORDERS
========================= */

const orderSchema = z.object({
  customerName: z.string().min(2).max(80),
  phone: z.string().min(8).max(20),
  address: z.string().min(5).max(300),

  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      qty: z.number().int().min(1).max(20)
    })
  ).min(1)
});

app.post("/api/orders", (req, res) => {

  const parsed = orderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid order details"
    });
  }

  const {
    customerName,
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

    const p = get.get(item.productId);

    if (!p) {
      return res.status(400).json({
        error: "Product not found"
      });
    }

    if (p.stock < item.qty) {
      return res.status(409).json({
        error: `Insufficient stock for ${p.name}`
      });
    }

    total += p.price * item.qty;

    lines.push({
      ...item,
      p
    });

  }

  const tx = db.transaction(() => {

    const info = db.prepare(
      "INSERT INTO orders(customer_name,phone,address,total,status,created_at) VALUES(?,?,?,?,?,datetime('now'))"
    ).run(
      customerName,
      phone,
      address,
      total,
      "pending"
    );

    for (const x of lines) {

      db.prepare(
        "INSERT INTO order_items(order_id,product_id,name,qty,price) VALUES(?,?,?,?,?)"
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

  res.status(201).json({
    orderId,
    total
  });

});

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
    "SELECT product_id,name,qty,price FROM order_items WHERE order_id=?"
  ).all(o.id);

  res.json(o);

});

app.get("/api/admin/orders", (req, res) => {

  if (
    req.headers["x-admin-key"] !== process.env.ADMIN_KEY
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  res.json(
    db.prepare("SELECT * FROM orders ORDER BY id DESC").all()
  );

});

app.listen(
  process.env.PORT || 4000,
  () => console.log("ZEVORIA API running")
);

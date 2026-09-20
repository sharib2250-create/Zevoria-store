require("dotenv").config();
const express=require("express"), helmet=require("helmet"), cors=require("cors"), rateLimit=require("express-rate-limit");
const Database=require("better-sqlite3"); const {z}=require("zod");
const app=express(), db=new Database("zevoria.db");
app.use(helmet()); app.use(cors({origin:process.env.FRONTEND_ORIGIN||"http://localhost:5500"}));
app.use(express.json({limit:"100kb"}));
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
db.exec(`CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,price INTEGER NOT NULL,stock INTEGER NOT NULL DEFAULT 0,note TEXT);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,product_id INTEGER,name TEXT,qty INTEGER,price INTEGER);`);
const seed=db.prepare("SELECT COUNT(*) c FROM products").get().c;
if(!seed) db.prepare("INSERT INTO products(name,category,price,stock,note) VALUES (?,?,?,?,?)").run("No. 01 Noir","men",1499,25,"Amber • Oud • Vanilla");

app.get("/api/health",(req,res)=>res.json({ok:true,service:"ZEVORIA API"}));
app.get("/api/products",(req,res)=>res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all()));

const orderSchema=z.object({customerName:z.string().min(2).max(80),phone:z.string().min(8).max(20),address:z.string().min(5).max(300),items:z.array(z.object({productId:z.number().int().positive(),qty:z.number().int().min(1).max(20)})).min(1)});
app.post("/api/orders",(req,res)=>{
  const parsed=orderSchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Invalid order details"});
  const {customerName,phone,address,items}=parsed.data;
  const get=db.prepare("SELECT * FROM products WHERE id=?");
  let total=0, lines=[];
  for(const item of items){const p=get.get(item.productId); if(!p)return res.status(400).json({error:"Product not found"}); if(p.stock<item.qty)return res.status(409).json({error:`Insufficient stock for ${p.name}`}); total+=p.price*item.qty; lines.push({...item,p});}
  const tx=db.transaction(()=>{const info=db.prepare("INSERT INTO orders(customer_name,phone,address,total,status,created_at) VALUES(?,?,?,?,?,datetime('now'))").run(customerName,phone,address,total,"pending"); for(const x of lines){db.prepare("INSERT INTO order_items(order_id,product_id,name,qty,price) VALUES(?,?,?,?,?)").run(info.lastInsertRowid,x.p.id,x.p.name,x.qty,x.p.price);db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(x.qty,x.p.id)} return info.lastInsertRowid;});
  res.status(201).json({orderId:tx(),total});
});
app.get("/api/orders/:id",(req,res)=>{const o=db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);if(!o)return res.status(404).json({error:"Order not found"});o.items=db.prepare("SELECT product_id,name,qty,price FROM order_items WHERE order_id=?").all(o.id);res.json(o)});
app.get("/api/admin/orders",(req,res)=>{if(req.headers["x-admin-key"]!==process.env.ADMIN_KEY)return res.status(401).json({error:"Unauthorized"});res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all())});
app.listen(process.env.PORT||4000,()=>console.log("ZEVORIA API running"));

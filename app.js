const API_BASE = "https://zevoria-backend.onrender.com";

const products=[
{name:"No. 01 Noir",cat:"men",type:"Eau de Parfum",price:1499,note:"Amber • Oud • Vanilla",backendId:1},
{name:"No. 02 Santal",cat:"unisex",type:"Eau de Parfum",price:1699,note:"Sandalwood • Musk • Cedar",backendId:2},
{name:"No. 03 Bloom",cat:"women",type:"Eau de Parfum",price:1399,note:"Rose • Peony • Vanilla",backendId:3},
{name:"No. 04 Oud",cat:"unisex",type:"Attar",price:899,note:"Oud • Saffron • Amber",backendId:4},
{name:"No. 05 Azure",cat:"men",type:"Eau de Parfum",price:1599,note:"Bergamot • Marine • Musk",backendId:5},
{name:"No. 06 Velvet",cat:"women",type:"Eau de Parfum",price:1499,note:"Iris • Tonka • Amber",backendId:6}
];

let cart=JSON.parse(localStorage.getItem("zevoriaCart")||"[]");
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=n=>"₹"+Number(n).toLocaleString("en-IN");

function renderProducts(list=products){
  $("#products").innerHTML=list.map(p=>`<article class="product">
    <div class="product-img"><button class="heart" onclick="wish(this)">♡</button><div class="mini-bottle"><div class="mini-cap"></div></div></div>
    <div class="product-info"><div class="meta">${p.type} · ${p.cat}</div><h3>${p.name}</h3><div class="meta">${p.note}</div><div class="price">${money(p.price)}</div><button class="add" onclick="add(${products.indexOf(p)})">Add to bag</button></div>
  </article>`).join("");
}

function add(i){
  const p=products[i],x=cart.find(x=>x.i===i);
  x?x.q++:cart.push({i,q:1});
  save();toast(p.name+" added to bag");openCart();
}

function save(){
  localStorage.setItem("zevoriaCart",JSON.stringify(cart));
  renderCart();
  $("#cartCount").textContent=cart.reduce((a,x)=>a+x.q,0);
}

function renderCart(){
  const el=$("#cartItems");
  if(!cart.length){el.innerHTML="<p class='muted'>Your bag is empty. Explore the collection and add a fragrance.</p>";$("#subtotal").textContent="₹0";return;}
  el.innerHTML=cart.map(x=>{
    const p=products[x.i];
    return `<div class="cart-row"><div class="cart-thumb"></div><div style="flex:1"><h4>${p.name}</h4><small>${money(p.price)}</small><div class="qty"><button onclick="change(${x.i},-1)">−</button>${x.q}<button onclick="change(${x.i},1)">+</button><button style="margin-left:auto;border:0;background:none;color:#9a3d32;cursor:pointer" onclick="removeItem(${x.i})">Remove</button></div></div></div>`;
  }).join("");
  $("#subtotal").textContent=money(cart.reduce((a,x)=>a+products[x.i].price*x.q,0));
}

function change(i,d){
  const x=cart.find(x=>x.i===i); if(!x)return;
  x.q+=d;if(x.q<=0)cart=cart.filter(x=>x.i!==i);save();
}
function removeItem(i){cart=cart.filter(x=>x.i!==i);save()}
function wish(b){b.textContent=b.textContent==="♡"?"♥":"♡";toast(b.textContent==="♥"?"Added to wishlist":"Removed from wishlist")}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function openCart(){$("#overlay").classList.add("show");$("#cartDrawer").classList.add("open")}
function closeAll(){$("#overlay").classList.remove("show");$("#cartDrawer").classList.remove("open");$$('.modal').forEach(x=>x.classList.remove("show"))}
function modal(id){$("#overlay").classList.add("show");$(id).classList.add("show")}

$("#cartBtn").onclick=openCart;
$("#searchBtn").onclick=()=>modal("#searchModal");
$("#accountBtn").onclick=()=>modal("#accountModal");
$("#overlay").onclick=closeAll;
$$('[data-close]').forEach(x=>x.onclick=closeAll);
$("#menuBtn").onclick=()=>$("#nav").classList.toggle("open");

$$('.filter').forEach(b=>b.onclick=()=>{
  $$('.filter').forEach(x=>x.classList.remove("active"));b.classList.add("active");
  renderProducts(b.dataset.filter==="all"?products:products.filter(p=>p.cat===b.dataset.filter));
});

$("#attarBtn").onclick=()=>{
  renderProducts(products.filter(p=>p.type==="Attar"));
  $("#shop").scrollIntoView({behavior:"smooth"});
};

$("#searchInput").oninput=e=>{
  const q=e.target.value.toLowerCase();
  $("#searchResults").innerHTML=products.filter(p=>(p.name+" "+p.note+" "+p.type).toLowerCase().includes(q)).map(p=>`<div class="search-result"><strong>${p.name}</strong><br><small>${p.note} · ${money(p.price)}</small></div>`).join("")||"<p class='muted'>No fragrance found.</p>";
};

$("#newsletter").onsubmit=e=>{e.preventDefault();toast("Thanks — you're on the list.");e.target.reset()};
$("#loginBtn").onclick=()=>toast("Demo sign-in submitted");

$("#checkoutBtn").onclick=()=>{
  if(!cart.length){toast("Your bag is empty");return;}
  modal("#checkoutModal");
};

async function submitOrder(form){
  const inputs=form.querySelectorAll("input");
  const customerName=inputs[0].value.trim();
  const phone=inputs[1].value.trim();
  const address=[inputs[2].value.trim(),inputs[3].value.trim(),inputs[4].value.trim()].filter(Boolean).join(", ");
  const items=cart.map(x=>({productId:products[x.i].backendId,qty:x.q}));

  const response=await fetch(`${API_BASE}/api/orders`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({customerName,phone,address,items})
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||"Could not place the order");
  return data;
}

$("#checkoutForm").onsubmit=async e=>{
  e.preventDefault();
  const form=e.target;
  const button=form.querySelector("button[type='submit'], button:last-of-type");
  const oldText=button.textContent;
  button.disabled=true;button.textContent="Placing order...";

  try{
    const data=await submitOrder(form);
    const orderId=data.orderId;
    cart=[];save();closeAll();
    toast(`Order placed successfully. Order #${orderId}`);
    setTimeout(()=>alert(`Thank you for your order!\n\nOrder ID: #${orderId}\nTotal: ${money(data.total)}\n\nWe will contact you on your phone number for delivery confirmation.`),250);
    form.reset();
  }catch(err){
    toast(err.message);
    alert(`Order could not be placed.\n\n${err.message}\n\nPlease try again.`);
  }finally{
    button.disabled=false;button.textContent=oldText;
  }
};

renderProducts();
save();

const API_BASE = "https://zevoria-backend.onrender.com";

const cart = JSON.parse(localStorage.getItem("zevoriaCart") || "[]");
const user = JSON.parse(localStorage.getItem("zevoriaUser") || "null");

const itemsContainer = document.getElementById("checkoutItems");
const subtotalElement = document.getElementById("subtotal");
const grandTotalElement = document.getElementById("grandTotal");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const successModal = document.getElementById("successModal");
const successMessage = document.getElementById("successMessage");

let products = [];


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/api/products`);

    if (!response.ok) {
      throw new Error("Unable to load products.");
    }

    products = await response.json();

    renderCheckout();

  } catch (error) {
    console.error(error);

    itemsContainer.innerHTML = `
      <p style="font-size:13px;color:#777;">
        Unable to load your cart. Please refresh the page.
      </p>
    `;
  }
}


/* =========================
   RENDER CHECKOUT
========================= */

function renderCheckout() {

  if (!cart.length) {

    itemsContainer.innerHTML = `
      <div style="padding:20px 0;text-align:center;">
        <p style="font-size:13px;color:#777;margin-bottom:15px;">
          Your cart is empty.
        </p>

        <a
          href="index.html"
          style="
            display:inline-block;
            background:#111;
            color:#fff;
            padding:12px 18px;
            text-decoration:none;
            font-size:11px;
            font-weight:600;
          "
        >
          CONTINUE SHOPPING
        </a>
      </div>
    `;

    subtotalElement.textContent = "₹0";
    grandTotalElement.textContent = "₹0";

    placeOrderBtn.disabled = true;

    return;
  }


  let subtotal = 0;

  itemsContainer.innerHTML = "";


  cart.forEach(cartItem => {

    const product = products.find(
      p => Number(p.id) === Number(cartItem.backendId || cartItem.id)
    );

    if (!product) return;


    const quantity = Number(cartItem.qty || cartItem.quantity || 1);

    const price = Number(product.price);

    const itemTotal = price * quantity;

    subtotal += itemTotal;


    const item = document.createElement("div");

    item.className = "checkout-item";

    item.innerHTML = `
      <img
        src="${product.image || ""}"
        alt="${escapeHTML(product.name)}"
        class="checkout-item-image"
      >

      <div class="checkout-item-info">

        <div class="checkout-item-name">
          ${escapeHTML(product.name)}
        </div>

        <div class="checkout-item-qty">
          Qty: ${quantity}
        </div>

      </div>

      <div class="checkout-item-price">
        ₹${itemTotal.toLocaleString("en-IN")}
      </div>
    `;

    itemsContainer.appendChild(item);

  });


  subtotalElement.textContent =
    `₹${subtotal.toLocaleString("en-IN")}`;

  grandTotalElement.textContent =
    `₹${subtotal.toLocaleString("en-IN")}`;
}


/* =========================
   PLACE ORDER
========================= */

placeOrderBtn.addEventListener("click", async () => {

  try {

    if (!cart.length) {
      throw new Error("Your cart is empty.");
    }


    if (!user || !user.email) {

      alert("Please sign in before placing your order.");

      window.location.href = "index.html";

      return;
    }


    const customerName =
      document.getElementById("fullName").value.trim();

    const customerEmail =
      document.getElementById("email").value.trim();

    const phone =
      document.getElementById("phone").value.trim();

    const address =
      document.getElementById("address").value.trim();

    const city =
      document.getElementById("city").value.trim();

    const state =
      document.getElementById("state").value.trim();

    const pincode =
      document.getElementById("pincode").value.trim();


    if (!customerName) {
      throw new Error("Please enter your full name.");
    }

    if (!customerEmail) {
      throw new Error("Please enter your email address.");
    }

    if (!phone) {
      throw new Error("Please enter your mobile number.");
    }

    if (!address) {
      throw new Error("Please enter your delivery address.");
    }

    if (!city) {
      throw new Error("Please enter your city.");
    }

    if (!state) {
      throw new Error("Please enter your state.");
    }

    if (!/^\d{6}$/.test(pincode)) {
      throw new Error("Please enter a valid 6-digit PIN code.");
    }


    /*
      Use the logged-in account email.
      This keeps the order connected to the customer account.
    */

    if (
      user.email.toLowerCase() !==
      customerEmail.toLowerCase()
    ) {

      throw new Error(
        "Please use the email address connected to your ZEVORIA account."
      );

    }


    placeOrderBtn.disabled = true;

    placeOrderBtn.textContent = "PLACING ORDER...";


    /*
      Combine the complete delivery address
      into the address field used by the backend.
    */

    const completeAddress =
      `${address}, ${city}, ${state} - ${pincode}`;


    /*
      Convert cart items into the format
      expected by the existing backend.
    */

    const orderItems = cart.map(item => {

      const backendId =
        Number(item.backendId || item.id);

      return {
        productId: backendId,
        qty: Number(item.qty || item.quantity || 1)
      };

    });


    const response = await fetch(
      `${API_BASE}/api/orders`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          customerName,

          customerEmail,

          phone,

          address: completeAddress,

          items: orderItems

        })
      }
    );


    const data = await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        data.message ||
        "Unable to place order."
      );

    }


    /*
      Order successfully created.
    */

    localStorage.removeItem("zevoriaCart");


    successMessage.innerHTML =
      `Your order <strong>#${data.orderId}</strong> has been placed successfully.<br><br>
       A confirmation email has been sent to <strong>${escapeHTML(customerEmail)}</strong>.`;


    successModal.classList.add("show");


  } catch (error) {

    console.error(error);

    alert(error.message);

    placeOrderBtn.disabled = false;

    placeOrderBtn.textContent = "PLACE ORDER";

  }

});


/* =========================
   PREFILL CUSTOMER DETAILS
========================= */

function prefillUser() {

  if (!user) return;


  const emailInput =
    document.getElementById("email");

  const nameInput =
    document.getElementById("fullName");


  if (user.email) {
    emailInput.value = user.email;
  }


  if (user.name) {
    nameInput.value = user.name;
  }

}


/* =========================
   SECURITY HELPER
========================= */

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================
   START
========================= */

prefillUser();

loadProducts();

const API_BASE = "https://zevoria-backend.onrender.com";

const cart = JSON.parse(
  localStorage.getItem("zevoriaCart") || "[]"
);

const PRODUCTS = [
  {
    id: 1,
    name: "No. 01 Noir",
    category: "men",
    type: "Eau de Parfum",
    price: 1499,
    notes: "Amber • Oud • Vanilla"
  },
  {
    id: 2,
    name: "No. 02 Santal",
    category: "unisex",
    type: "Eau de Parfum",
    price: 1699,
    notes: "Sandalwood • Musk • Cedar"
  },
  {
    id: 3,
    name: "No. 03 Bloom",
    category: "women",
    type: "Eau de Parfum",
    price: 1399,
    notes: "Rose • Peony • Vanilla"
  },
  {
    id: 4,
    name: "No. 04 Oud",
    category: "unisex",
    type: "Attar",
    price: 899,
    notes: "Oud • Saffron • Amber"
  },
  {
    id: 5,
    name: "No. 05 Azure",
    category: "men",
    type: "Eau de Parfum",
    price: 1599,
    notes: "Bergamot • Marine • Musk"
  },
  {
    id: 6,
    name: "No. 06 Velvet",
    category: "women",
    type: "Eau de Parfum",
    price: 1499,
    notes: "Iris • Tonka • Amber"
  }
];


/* =========================================
   HELPERS
   ========================================= */

const $ = selector => document.querySelector(selector);

function money(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================
   CART
   ========================================= */

const cartItems = cart
  .map(item => {

    const product = PRODUCTS.find(
      p => p.id === Number(item.i)
    );

    if (!product) {
      return null;
    }

    return {
      ...product,
      qty: Math.max(
        1,
        Number(item.q) || 1
      )
    };

  })
  .filter(Boolean);


/* =========================================
   LOGGED-IN USER
   ========================================= */

function getLoggedInUser() {

  try {

    return JSON.parse(
      localStorage.getItem("zevoriaUser") || "null"
    );

  } catch {

    return null;

  }

}


/* =========================================
   RENDER CART
   ========================================= */

function renderCart() {

  const container =
    $("#checkoutItems") ||
    $("#orderItems") ||
    $(".checkout-items");

  if (!container) {
    return;
  }


  if (!cartItems.length) {

    container.innerHTML = `
      <div class="checkout-empty">
        <h3>Your bag is empty</h3>

        <p>
          Add a fragrance before continuing to checkout.
        </p>

        <a href="index.html">
          Continue Shopping
        </a>
      </div>
    `;


    const submitButton =
      $("#placeOrderBtn") ||
      $("#submitOrder") ||
      document.querySelector(
        'button[type="submit"]'
      );


    if (submitButton) {
      submitButton.disabled = true;
    }

    return;
  }


  container.innerHTML = cartItems
    .map(item => {

      const subtotal =
        item.price * item.qty;


      return `
        <div class="checkout-item">

          <div class="checkout-item-image"></div>

          <div class="checkout-item-info">

            <strong>
              ${escapeHTML(item.name)}
            </strong>

            <small>
              ${escapeHTML(item.type)}
              ·
              ${escapeHTML(item.notes)}
            </small>

            <small>
              Quantity: ${item.qty}
            </small>

          </div>

          <div class="checkout-item-price">
            ${money(subtotal)}
          </div>

        </div>
      `;

    })
    .join("");

}


/* =========================================
   TOTALS
   ========================================= */

function calculateSubtotal() {

  return cartItems.reduce(
    (total, item) =>
      total + item.price * item.qty,
    0
  );

}


function renderTotals() {

  const subtotal =
    calculateSubtotal();

  const delivery = 0;

  const total =
    subtotal + delivery;


  const subtotalElement =
    $("#checkoutSubtotal");

  const deliveryElement =
    $("#checkoutDelivery");

  const totalElement =
    $("#checkoutTotal");


  if (subtotalElement) {

    subtotalElement.textContent =
      money(subtotal);

  }


  if (deliveryElement) {

    deliveryElement.textContent =
      delivery === 0
        ? "FREE"
        : money(delivery);

  }


  if (totalElement) {

    totalElement.textContent =
      money(total);

  }

}


/* =========================================
   PREFILL CUSTOMER
   ========================================= */

function prefillCustomerDetails() {

  const user =
    getLoggedInUser();

  if (!user) {
    return;
  }


  const nameInput =
    $("#customerName");

  const emailInput =
    $("#customerEmail");

  const phoneInput =
    $("#phone");


  if (nameInput && user.name) {

    nameInput.value =
      user.name;

  }


  if (emailInput && user.email) {

    emailInput.value =
      user.email;

  }


  if (phoneInput && user.phone) {

    phoneInput.value =
      user.phone;

  }

}


/* =========================================
   GET FORM VALUE
   ========================================= */

function getValue(selectors) {

  for (const selector of selectors) {

    const element =
      document.querySelector(selector);

    if (
      element &&
      String(element.value).trim()
    ) {

      return String(
        element.value
      ).trim();

    }

  }

  return "";
}


/* =========================================
   FORM DATA
   ========================================= */

function getFormData() {

  const customerName =
    getValue([
      "#customerName",
      '[name="customerName"]'
    ]);


  const customerEmail =
    getValue([
      "#customerEmail",
      '[name="customerEmail"]'
    ]);


  const phone =
    getValue([
      "#phone",
      '[name="phone"]'
    ])
    .replace(/\s+/g, "");


  const addressLine =
    getValue([
      "#address",
      '[name="address"]'
    ]);


  const city =
    getValue([
      "#city",
      '[name="city"]'
    ]);


  const state =
    getValue([
      "#state",
      '[name="state"]'
    ]);


  const pincode =
    getValue([
      "#pincode",
      '[name="pincode"]'
    ]);


  return {
    customerName,
    customerEmail,
    phone,
    addressLine,
    city,
    state,
    pincode
  };

}


/* =========================================
   VALIDATION
   ========================================= */

function validateIndianPhone(phone) {

  return /^[6-9]\d{9}$/.test(phone);

}


function validatePincode(pincode) {

  return /^\d{6}$/.test(pincode);

}


function validateEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}


function validateForm(data) {

  if (!data.customerName) {

    showMessage(
      "Please enter your full name."
    );

    return false;
  }


  if (!data.customerEmail) {

    showMessage(
      "Please enter your email address."
    );

    return false;
  }


  if (!validateEmail(data.customerEmail)) {

    showMessage(
      "Please enter a valid email address."
    );

    return false;
  }


  if (!data.phone) {

    showMessage(
      "Please enter your mobile number."
    );

    return false;
  }


  if (!validateIndianPhone(data.phone)) {

    showMessage(
      "Please enter a valid 10-digit Indian mobile number."
    );

    return false;
  }


  if (!data.addressLine) {

    showMessage(
      "Please enter your complete address."
    );

    return false;
  }


  if (!data.city) {

    showMessage(
      "Please enter your city."
    );

    return false;
  }


  if (!data.state) {

    showMessage(
      "Please select your state."
    );

    return false;
  }


  if (!data.pincode) {

    showMessage(
      "Please enter your PIN code."
    );

    return false;
  }


  if (!validatePincode(data.pincode)) {

    showMessage(
      "Please enter a valid 6-digit PIN code."
    );

    return false;
  }


  return true;

}


/* =========================================
   ADDRESS
   ========================================= */

function buildAddress(data) {

  return [
    data.addressLine,
    data.city,
    data.state,
    data.pincode
  ]
    .filter(Boolean)
    .join(", ");

}


/* =========================================
   MESSAGE
   ========================================= */

function showMessage(
  message,
  type = "error"
) {

  const box =
    $("#checkoutMessage");

  if (!box) {
    alert(message);
    return;
  }


  box.textContent =
    message;

  box.className =
    `checkout-message ${type}`;

}


function clearMessage() {

  const box =
    $("#checkoutMessage");

  if (!box) {
    return;
  }


  box.textContent = "";

  box.className =
    "checkout-message";

}


/* =========================================
   SAVE ORDER LOCALLY
   ========================================= */

function saveOrderForCustomer(orderData) {

  let existing = [];

  try {

    existing = JSON.parse(
      localStorage.getItem(
        "zevoriaOrders"
      ) || "[]"
    );

  } catch {

    existing = [];

  }


  const order = {

    orderId:
      orderData.orderId,

    orderToken:
      orderData.orderToken || "",

    total:
      Number(orderData.total) || 0,

    paymentMethod:
      "COD",

    createdAt:
      new Date().toISOString()

  };


  const existingIndex =
    existing.findIndex(
      item =>
        String(item.orderId) ===
        String(order.orderId)
    );


  if (existingIndex >= 0) {

    existing[existingIndex] = {
      ...existing[existingIndex],
      ...order
    };

  } else {

    existing.unshift(order);

  }


  localStorage.setItem(
    "zevoriaOrders",
    JSON.stringify(existing)
  );

}


/* =========================================
   TELL app.js ABOUT ORDER
   ========================================= */

function notifyAppAboutOrder(orderData) {

  if (
    typeof window.rememberOrderFromCheckout ===
    "function"
  ) {

    window.rememberOrderFromCheckout(
      orderData.orderId,
      orderData.total,
      orderData.orderToken
    );

  }

}


/* =========================================
   ORDER CONFIRMATION
   ========================================= */

function showSuccess(orderData) {

  const successContainer =
    $("#checkoutSuccess");


  if (!successContainer) {

    alert(
      `Order Confirmed!\n\n` +
      `Order #${orderData.orderId}\n` +
      `Total: ${money(orderData.total)}\n` +
      `Payment: Cash on Delivery`
    );

    return;

  }


  const orderIdElement =
    $("#successOrderId");


  const totalElement =
    $("#successTotal");


  if (orderIdElement) {

    orderIdElement.textContent =
      `#${orderData.orderId}`;

  }


  if (totalElement) {

    totalElement.textContent =
      money(orderData.total);

  }


  /*
   * IMPORTANT:
   * Hide checkout after successful order.
   */

  const checkoutWrapper =
    document.querySelector(
      ".checkout-wrapper"
    );


  if (checkoutWrapper) {

    checkoutWrapper.style.display =
      "none";

  }


  /*
   * Show ORDER CONFIRMED screen.
   */

  successContainer.style.display =
    "flex";


  /*
   * Scroll to top.
   */

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


/* =========================================
   PLACE ORDER
   ========================================= */

async function placeOrder(event) {

  event.preventDefault();

  clearMessage();


  if (!cartItems.length) {

    showMessage(
      "Your bag is empty."
    );

    return;

  }


  const data =
    getFormData();


  if (!validateForm(data)) {

    return;

  }


  const submitButton =
    $("#placeOrderBtn");


  const originalText =
    submitButton
      ? submitButton.innerHTML
      : "PLACE ORDER";


  if (submitButton) {

    submitButton.disabled =
      true;

    submitButton.innerHTML =
      `<span>PLACING ORDER...</span>`;

  }


  try {

    /*
     * SEND ORDER TO BACKEND
     */

    const response =
      await fetch(
        `${API_BASE}/api/orders`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            customerName:
              data.customerName,

            customerEmail:
              data.customerEmail,

            phone:
              data.phone,

            address:
              buildAddress(data),

            paymentMethod:
              "COD",

            items:
              cartItems.map(item => ({
                productId:
                  item.id,

                qty:
                  item.qty
              }))

          })
        }
      );


    const result =
      await response
        .json()
        .catch(() => ({}));


    /*
     * BACKEND ERROR
     */

    if (!response.ok) {

      throw new Error(
        result.error ||
        result.message ||
        "Unable to place your order."
      );

    }


    /*
     * MAKE SURE ORDER ID EXISTS
     */

    if (!result.orderId) {

      throw new Error(
        "Order was not confirmed by the server."
      );

    }


    /*
     * CREATE ORDER DATA
     */

    const orderData = {

      orderId:
        result.orderId,

      total:
        Number(result.total) || 0,

      orderToken:
        result.orderToken || "",

      paymentMethod:
        "COD"

    };


    /*
     * SAVE ORDER HISTORY
     */

    saveOrderForCustomer(
      orderData
    );


    /*
     * UPDATE app.js
     */

    notifyAppAboutOrder(
      orderData
    );


    /*
     * CLEAR CART ONLY AFTER
     * SUCCESSFUL BACKEND RESPONSE
     */

    localStorage.removeItem(
      "zevoriaCart"
    );


    /*
     * SHOW ORDER CONFIRMED
     */

    showSuccess(
      orderData
    );


  } catch (error) {

    console.error(
      "ZEVORIA checkout error:",
      error
    );


    showMessage(
      error.message ||
      "Something went wrong while placing your order."
    );


  } finally {

    if (submitButton) {

      submitButton.disabled =
        false;

      submitButton.innerHTML =
        originalText;

    }

  }

}


/* =========================================
   INITIALIZE
   ========================================= */

function initializeCheckout() {

  renderCart();

  renderTotals();

  prefillCustomerDetails();


  const form =
    $("#checkoutForm");


  if (form) {

    form.addEventListener(
      "submit",
      placeOrder
    );

  }


  console.log(
    "ZEVORIA checkout initialized."
  );

}


document.addEventListener(
  "DOMContentLoaded",
  initializeCheckout
);

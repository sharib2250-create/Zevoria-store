const API_BASE = "https://zevoria-backend.onrender.com";

const cart = JSON.parse(localStorage.getItem("zevoriaCart") || "[]");

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

const cartItems = cart
  .map(item => {
    const product = PRODUCTS.find(p => p.id === Number(item.i));

    if (!product) return null;

    return {
      ...product,
      qty: Math.max(1, Number(item.q) || 1)
    };
  })
  .filter(Boolean);

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

function getLoggedInUser() {
  try {
    return JSON.parse(localStorage.getItem("zevoriaUser") || "null");
  } catch {
    return null;
  }
}

function renderCart() {
  const container =
    $("#checkoutItems") ||
    $("#orderItems") ||
    $(".checkout-items");

  if (!container) return;

  if (!cartItems.length) {
    container.innerHTML = `
      <div class="checkout-empty">
        <h3>Your bag is empty</h3>
        <p>Add a fragrance before continuing to checkout.</p>
        <a href="index.html">Continue Shopping</a>
      </div>
    `;

    const submitButton =
      $("#placeOrderBtn") ||
      $("#submitOrder") ||
      document.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    return;
  }

  container.innerHTML = cartItems
    .map(item => {
      const subtotal = item.price * item.qty;

      return `
        <div class="checkout-item">
          <div class="checkout-item-info">
            <div class="checkout-item-name">
              ${escapeHTML(item.name)}
            </div>

            <div class="checkout-item-meta">
              ${escapeHTML(item.type)} • ${escapeHTML(item.notes)}
            </div>

            <div class="checkout-item-qty">
              Quantity: ${item.qty}
            </div>
          </div>

          <div class="checkout-item-price">
            ${money(subtotal)}
          </div>
        </div>
      `;
    })
    .join("");
}

function calculateSubtotal() {
  return cartItems.reduce(
    (total, item) => total + item.price * item.qty,
    0
  );
}

function renderTotals() {
  const subtotal = calculateSubtotal();

  // COD is currently free delivery.
  const delivery = 0;

  const total = subtotal + delivery;

  const subtotalElement =
    $("#checkoutSubtotal") ||
    $("#subtotal") ||
    document.querySelector("[data-subtotal]");

  const deliveryElement =
    $("#checkoutDelivery") ||
    $("#delivery") ||
    document.querySelector("[data-delivery]");

  const totalElement =
    $("#checkoutTotal") ||
    $("#total") ||
    document.querySelector("[data-total]");

  if (subtotalElement) {
    subtotalElement.textContent = money(subtotal);
  }

  if (deliveryElement) {
    deliveryElement.textContent =
      delivery === 0 ? "FREE" : money(delivery);
  }

  if (totalElement) {
    totalElement.textContent = money(total);
  }
}

function prefillCustomerDetails() {
  const user = getLoggedInUser();

  if (!user) return;

  const nameInput =
    $("#customerName") ||
    $("#fullName") ||
    $("#name") ||
    document.querySelector('[name="customerName"]');

  const emailInput =
    $("#customerEmail") ||
    $("#email") ||
    document.querySelector('[name="customerEmail"]');

  const phoneInput =
    $("#phone") ||
    document.querySelector('[name="phone"]');

  if (nameInput && user.name) {
    nameInput.value = user.name;
  }

  if (emailInput && user.email) {
    emailInput.value = user.email;
  }

  if (phoneInput && user.phone) {
    phoneInput.value = user.phone;
  }
}

function getValue(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element && String(element.value).trim()) {
      return String(element.value).trim();
    }
  }

  return "";
}

function showMessage(message, type = "error") {
  let box = $("#checkoutMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "checkoutMessage";

    const form =
      $("#checkoutForm") ||
      document.querySelector("form");

    if (form) {
      form.prepend(box);
    } else {
      document.body.prepend(box);
    }
  }

  box.className = `checkout-message ${type}`;
  box.textContent = message;

  box.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function clearMessage() {
  const box = $("#checkoutMessage");

  if (box) {
    box.textContent = "";
    box.className = "";
  }
}

function validateIndianPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function validatePincode(pincode) {
  return /^\d{6}$/.test(pincode);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getFormData() {
  const customerName = getValue([
    "#customerName",
    "#fullName",
    "#name",
    '[name="customerName"]',
    '[name="fullName"]'
  ]);

  const customerEmail = getValue([
    "#customerEmail",
    "#email",
    '[name="customerEmail"]',
    '[name="email"]'
  ]);

  const phone = getValue([
    "#phone",
    "#mobile",
    '[name="phone"]',
    '[name="mobile"]'
  ]).replace(/\s+/g, "");

  const addressLine = getValue([
    "#address",
    "#addressLine",
    '[name="address"]',
    '[name="addressLine"]'
  ]);

  const city = getValue([
    "#city",
    '[name="city"]'
  ]);

  const state = getValue([
    "#state",
    '[name="state"]'
  ]);

  const pincode = getValue([
    "#pincode",
    "#pinCode",
    "#zip",
    '[name="pincode"]',
    '[name="pinCode"]',
    '[name="zip"]'
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

function validateForm(data) {
  if (!data.customerName) {
    showMessage("Please enter your full name.");
    return false;
  }

  if (!data.customerEmail) {
    showMessage("Please enter your email address.");
    return false;
  }

  if (!validateEmail(data.customerEmail)) {
    showMessage("Please enter a valid email address.");
    return false;
  }

  if (!data.phone) {
    showMessage("Please enter your mobile number.");
    return false;
  }

  if (!validateIndianPhone(data.phone)) {
    showMessage("Please enter a valid 10-digit Indian mobile number.");
    return false;
  }

  if (!data.addressLine) {
    showMessage("Please enter your complete address.");
    return false;
  }

  if (!data.city) {
    showMessage("Please enter your city.");
    return false;
  }

  if (!data.state) {
    showMessage("Please enter your state.");
    return false;
  }

  if (!data.pincode) {
    showMessage("Please enter your PIN code.");
    return false;
  }

  if (!validatePincode(data.pincode)) {
    showMessage("Please enter a valid 6-digit PIN code.");
    return false;
  }

  return true;
}

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

function saveOrderForCustomer(orderData) {
  const existing = JSON.parse(
    localStorage.getItem("zevoriaOrders") || "[]"
  );

  const order = {
    orderId: orderData.orderId,
    orderToken: orderData.orderToken || "",
    total: Number(orderData.total) || 0,
    paymentMethod: "COD",
    createdAt: new Date().toISOString()
  };

  const index = existing.findIndex(
    item => String(item.orderId) === String(order.orderId)
  );

  if (index >= 0) {
    existing[index] = {
      ...existing[index],
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

function notifyAppAboutOrder(orderData) {
  // app.js exposes this function.
  if (
    typeof window.rememberOrderFromCheckout === "function"
  ) {
    window.rememberOrderFromCheckout(
      orderData.orderId,
      orderData.total,
      orderData.orderToken
    );
  }
}

function showSuccess(orderData) {
  const orderNumber = escapeHTML(orderData.orderId);
  const total = money(orderData.total);

  const modal =
    $("#successModal") ||
    $("#orderSuccessModal");

  if (modal) {
    modal.classList.add("active");
    modal.classList.add("show");

    const orderNumberElement =
      modal.querySelector(".success-order-number") ||
      modal.querySelector("[data-order-id]");

    const totalElement =
      modal.querySelector(".success-total") ||
      modal.querySelector("[data-total]");

    if (orderNumberElement) {
      orderNumberElement.textContent = orderNumber;
    }

    if (totalElement) {
      totalElement.textContent = total;
    }

    return;
  }

  const successContainer =
    $("#checkoutSuccess") ||
    document.querySelector(".checkout-success");

  if (successContainer) {
    successContainer.innerHTML = `
      <div class="success-icon">✓</div>

      <h2>Order Confirmed</h2>

      <p>
        Thank you for shopping with ZEVORIA.
      </p>

      <p>
        Your order number is
        <strong>#${orderNumber}</strong>
      </p>

      <p>
        Total:
        <strong>${total}</strong>
      </p>

      <p>
        Payment Method:
        <strong>Cash on Delivery</strong>
      </p>

      <div class="success-actions">
        <a href="index.html">Continue Shopping</a>
      </div>
    `;

    successContainer.style.display = "block";

    return;
  }

  alert(
    `Order confirmed!\n\nOrder #${orderData.orderId}\nTotal: ${total}\nPayment: Cash on Delivery`
  );
}

async function placeOrder(event) {
  event.preventDefault();

  clearMessage();

  if (!cartItems.length) {
    showMessage("Your cart is empty.");
    return;
  }

  const data = getFormData();

  if (!validateForm(data)) {
    return;
  }

  const submitButton =
    $("#placeOrderBtn") ||
    $("#submitOrder") ||
    document.querySelector(
      '#checkoutForm button[type="submit"]'
    ) ||
    document.querySelector(
      'form button[type="submit"]'
    );

  const originalButtonText = submitButton
    ? submitButton.textContent
    : "";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Placing Order...";
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          phone: data.phone,
          address: buildAddress(data),

          // COD only for now.
          paymentMethod: "COD",

          items: cartItems.map(item => ({
            productId: item.id,
            qty: item.qty
          }))
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message ||
        result.error ||
        "Unable to place your order."
      );
    }

    if (!result.orderId) {
      throw new Error(
        "The server did not return an order number."
      );
    }

    /*
      IMPORTANT:

      The secure backend should return:

      {
        orderId,
        total,
        paymentMethod: "COD",
        orderToken
      }

      The orderToken is required for secure
      customer order tracking.
    */

    const orderData = {
      orderId: result.orderId,
      total: Number(result.total) || 0,
      orderToken: result.orderToken || "",
      paymentMethod: "COD"
    };

    saveOrderForCustomer(orderData);

    notifyAppAboutOrder(orderData);

    // Cart is cleared only AFTER the server successfully
    // creates the order.
    localStorage.removeItem("zevoriaCart");

    showSuccess(orderData);

    /*
      Give the email system a moment to process the request,
      but do not block the order confirmation if email delivery
      takes longer.
    */

  } catch (error) {
    console.error("Checkout error:", error);

    showMessage(
      error.message ||
      "Something went wrong while placing your order."
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText || "Place Order";
    }
  }
}

function setupForm() {
  const form =
    $("#checkoutForm") ||
    document.querySelector("form");

  if (!form) {
    console.warn("Checkout form not found.");
    return;
  }

  form.addEventListener("submit", placeOrder);
}

function setupSuccessButtons() {
  document.addEventListener("click", event => {
    const continueButton =
      event.target.closest("[data-continue-shopping]");

    if (continueButton) {
      window.location.href = "index.html";
    }

    const trackButton =
      event.target.closest("[data-track-order]");

    if (trackButton) {
      const orderId =
        trackButton.dataset.trackOrder;

      if (orderId) {
        window.location.href =
          `index.html?track=${encodeURIComponent(orderId)}`;
      }
    }
  });
}

function initializeCheckout() {
  renderCart();
  renderTotals();
  prefillCustomerDetails();
  setupForm();
  setupSuccessButtons();

  console.log("ZEVORIA checkout initialized.");
}

document.addEventListener(
  "DOMContentLoaded",
  initializeCheckout
);

const API_BASE = "https://zevoria-backend.onrender.com";


/* =========================
   PRODUCTS
========================= */

const products = [
  {
    name: "No. 01 Noir",
    type: "Eau de Parfum",
    price: 1499,
    backendId: 1
  },
  {
    name: "No. 02 Santal",
    type: "Eau de Parfum",
    price: 1699,
    backendId: 2
  },
  {
    name: "No. 03 Bloom",
    type: "Eau de Parfum",
    price: 1399,
    backendId: 3
  },
  {
    name: "No. 04 Oud",
    type: "Attar",
    price: 899,
    backendId: 4
  },
  {
    name: "No. 05 Azure",
    type: "Eau de Parfum",
    price: 1599,
    backendId: 5
  },
  {
    name: "No. 06 Velvet",
    type: "Eau de Parfum",
    price: 1499,
    backendId: 6
  }
];


/* =========================
   CART
========================= */

let cart = JSON.parse(
  localStorage.getItem("zevoriaCart") || "[]"
);


/* =========================
   USER
========================= */

const user = JSON.parse(
  localStorage.getItem("zevoriaUser") || "null"
);


/* =========================
   MONEY
========================= */

function money(amount) {

  return "₹" +
    Number(amount).toLocaleString("en-IN");

}


/* =========================
   HTML ELEMENTS
========================= */

const checkoutItems =
  document.getElementById("checkoutItems");

const subtotalEl =
  document.getElementById("subtotal");

const deliveryEl =
  document.getElementById("delivery");

const totalEl =
  document.getElementById("grandTotal");

const emailInput =
  document.getElementById("email");

const fullNameInput =
  document.getElementById("fullName");

const phoneInput =
  document.getElementById("phone");

const addressInput =
  document.getElementById("address");

const cityInput =
  document.getElementById("city");

const stateInput =
  document.getElementById("state");

const pincodeInput =
  document.getElementById("pincode");

const placeOrderBtn =
  document.getElementById("placeOrderBtn");

const successModal =
  document.getElementById("successModal");

const successMessage =
  document.getElementById("successMessage");


/* =========================
   LOAD USER EMAIL
========================= */

if (user && user.email) {

  emailInput.value =
    user.email;

}


/* =========================
   RENDER CHECKOUT
========================= */

function renderCheckout() {

  /*
    Always reload the latest cart
    from localStorage.
  */

  cart = JSON.parse(
    localStorage.getItem("zevoriaCart") || "[]"
  );


  /* =========================
     EMPTY CART
  ========================= */

  if (!cart.length) {

    checkoutItems.innerHTML = `
      <div class="empty-checkout">

        <h3>
          Your bag is empty
        </h3>

        <p>
          Add a fragrance before
          continuing to checkout.
        </p>

        <a href="index.html">
          Continue Shopping
        </a>

      </div>
    `;

    subtotalEl.textContent =
      "₹0";

    deliveryEl.textContent =
      "FREE";

    totalEl.textContent =
      "₹0";

    placeOrderBtn.disabled =
      true;

    return;

  }


  /* =========================
     CALCULATE SUBTOTAL
  ========================= */

  let subtotal = 0;


  checkoutItems.innerHTML =
    cart.map(item => {

      const product =
        products[Number(item.i)];


      if (!product) {
        return "";
      }


      const quantity =
        Number(item.q) || 1;


      const itemTotal =
        Number(product.price) *
        quantity;


      subtotal +=
        itemTotal;


      return `
        <div class="checkout-item">

          <div class="checkout-item-info">

            <h3>
              ${product.name}
            </h3>

            <p>
              ${product.type}
            </p>

            <span>
              ${money(product.price)}
              ×
              ${quantity}
            </span>

          </div>

          <strong>
            ${money(itemTotal)}
          </strong>

        </div>
      `;

    }).join("");


  /* =========================
     DELIVERY
  ========================= */

  const delivery = 0;


  /* =========================
     GRAND TOTAL
  ========================= */

  const grandTotal =
    subtotal + delivery;


  /* =========================
     DISPLAY AMOUNTS
  ========================= */

  subtotalEl.textContent =
    money(subtotal);

  deliveryEl.textContent =
    delivery === 0
      ? "FREE"
      : money(delivery);

  totalEl.textContent =
    money(grandTotal);


  /* =========================
     ENABLE ORDER BUTTON
  ========================= */

  placeOrderBtn.disabled =
    false;

}


/* =========================
   START
========================= */

renderCheckout();


/* =========================
   PLACE ORDER
========================= */

placeOrderBtn.addEventListener(
  "click",
  async () => {

    /* =========================
       RELOAD CART
    ========================= */

    cart = JSON.parse(
      localStorage.getItem("zevoriaCart") || "[]"
    );


    if (!cart.length) {

      alert(
        "Your bag is empty."
      );

      return;

    }


    /* =========================
       CHECK LOGIN
    ========================= */

    if (!user || !user.email) {

      alert(
        "Please sign in to your ZEVORIA account before placing your order."
      );

      window.location.href =
        "index.html";

      return;

    }


    /* =========================
       GET CUSTOMER DETAILS
    ========================= */

    const email =
      emailInput.value.trim();

    const customerName =
      fullNameInput.value.trim();

    const phone =
      phoneInput.value.trim();

    const address =
      addressInput.value.trim();

    const city =
      cityInput.value.trim();

    const state =
      stateInput.value.trim();

    const pincode =
      pincodeInput.value.trim();


    /* =========================
       VALIDATION
    ========================= */

    if (!email) {

      alert(
        "Please enter your email address."
      );

      emailInput.focus();

      return;

    }


    if (!customerName) {

      alert(
        "Please enter your full name."
      );

      fullNameInput.focus();

      return;

    }


    if (!phone) {

      alert(
        "Please enter your mobile number."
      );

      phoneInput.focus();

      return;

    }


    if (!address) {

      alert(
        "Please enter your address."
      );

      addressInput.focus();

      return;

    }


    if (!city) {

      alert(
        "Please enter your city."
      );

      cityInput.focus();

      return;

    }


    if (!state) {

      alert(
        "Please enter your state."
      );

      stateInput.focus();

      return;

    }


    if (!/^\d{6}$/.test(pincode)) {

      alert(
        "Please enter a valid 6-digit PIN code."
      );

      pincodeInput.focus();

      return;

    }


    /* =========================
       CREATE ORDER ITEMS
    ========================= */

    const items =
      cart
        .map(item => {

          const product =
            products[Number(item.i)];


          if (!product) {
            return null;
          }


          return {

            productId:
              product.backendId,

            qty:
              Number(item.q) || 1

          };

        })
        .filter(Boolean);


    /* =========================
       FULL ADDRESS
    ========================= */

    const fullAddress =
      [
        address,
        city,
        state,
        pincode
      ]
        .filter(Boolean)
        .join(", ");


    /* =========================
       BUTTON LOADING
    ========================= */

    const oldText =
      placeOrderBtn.textContent;


    placeOrderBtn.disabled =
      true;

    placeOrderBtn.textContent =
      "Placing Order...";


    /* =========================
       SEND TO BACKEND
    ========================= */

    try {

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
                customerName,

              customerEmail:
                email,

              phone:
                phone,

              address:
                fullAddress,

              items:
                items

            })

          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      /* =========================
         CHECK RESPONSE
      ========================= */

      if (!response.ok) {

        throw new Error(
          data.error ||
          data.message ||
          "Could not place order."
        );

      }


      /* =========================
         CLEAR CART
      ========================= */

      localStorage.removeItem(
        "zevoriaCart"
      );

      cart = [];


      /* =========================
         SUCCESS
      ========================= */

      if (successMessage) {

        successMessage.innerHTML = `
          Your ZEVORIA order has been
          placed successfully.

          <br><br>

          <strong>
            Order #${data.orderId}
          </strong>

          <br>

          <strong>
            Total: ${money(data.total)}
          </strong>

          <br><br>

          A confirmation email has been
          sent to ${email}.
        `;

      }


      if (successModal) {

        successModal.classList.add(
          "show"
        );

      } else {

        alert(
          "Order placed successfully!\n\n" +
          "Order #" +
          data.orderId +
          "\n" +
          "Total: " +
          money(data.total)
        );

        window.location.href =
          "index.html";

      }


    } catch (error) {

      console.error(
        "ORDER ERROR:",
        error
      );


      alert(
        "Order could not be placed.\n\n" +
        error.message
      );


    } finally {

      placeOrderBtn.disabled =
        false;

      placeOrderBtn.textContent =
        oldText;

    }

  }
);

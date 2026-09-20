const API_BASE = "https://zevoria-backend.onrender.com";

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

let cart = JSON.parse(
  localStorage.getItem("zevoriaCart") || "[]"
);

const money = n =>
  "₹" + Number(n).toLocaleString("en-IN");


/* =========================
   USER
========================= */

const user = JSON.parse(
  localStorage.getItem("zevoriaUser") || "null"
);


/* =========================
   ELEMENTS
========================= */

const checkoutItems =
  document.querySelector("#checkoutItems");

const subtotalEl =
  document.querySelector("#checkoutSubtotal");

const deliveryEl =
  document.querySelector("#checkoutDelivery");

const totalEl =
  document.querySelector("#checkoutTotal");

const emailInput =
  document.querySelector("#checkoutEmail");


/* =========================
   EMAIL
========================= */

if (user && user.email) {

  emailInput.value =
    user.email;

}


/* =========================
   CHECK CART
========================= */

if (!cart.length) {

  checkoutItems.innerHTML = `
    <div class="empty-checkout">
      <h3>Your bag is empty</h3>

      <p>
        Add a fragrance before
        continuing to checkout.
      </p>

      <a href="index.html">
        Continue Shopping
      </a>
    </div>
  `;

}


/* =========================
   RENDER ORDER
========================= */

function renderCheckout() {

  if (!cart.length) {

    subtotalEl.textContent =
      "₹0";

    deliveryEl.textContent =
      "₹0";

    totalEl.textContent =
      "₹0";

    return;

  }


  checkoutItems.innerHTML =
    cart.map(item => {

      const product =
        products[item.i];

      if (!product) return "";


      const quantity =
        item.q || 1;


      const itemTotal =
        product.price *
        quantity;


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
              Qty: ${quantity}
            </span>

          </div>

          <strong>
            ${money(itemTotal)}
          </strong>

        </div>
      `;

    }).join("");


  const subtotal =
    cart.reduce(
      (total, item) => {

        const product =
          products[item.i];

        return total +
          product.price *
          item.q;

      },
      0
    );


  /*
    Free delivery for now.
  */

  const delivery = 0;

  const total =
    subtotal + delivery;


  subtotalEl.textContent =
    money(subtotal);

  deliveryEl.textContent =
    delivery === 0
      ? "FREE"
      : money(delivery);

  totalEl.textContent =
    money(total);

}


renderCheckout();


/* =========================
   PLACE ORDER
========================= */

const checkoutForm =
  document.querySelector("#checkoutForm");


checkoutForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    if (!cart.length) {

      alert(
        "Your bag is empty."
      );

      return;

    }


    if (!user || !user.email) {

      alert(
        "Please sign in to your ZEVORIA account before placing your order."
      );

      window.location.href =
        "index.html";

      return;

    }


    const submitButton =
      checkoutForm.querySelector(
        "button[type='submit']"
      );


    const originalText =
      submitButton.textContent;


    submitButton.disabled =
      true;

    submitButton.textContent =
      "Placing Order...";


    const formData =
      new FormData(
        checkoutForm
      );


    const customerName =
      formData
        .get("name")
        ?.trim();


    const phone =
      formData
        .get("phone")
        ?.trim();


    const address =
      formData
        .get("address")
        ?.trim();


    const city =
      formData
        .get("city")
        ?.trim();


    const state =
      formData
        .get("state")
        ?.trim();


    const pincode =
      formData
        .get("pincode")
        ?.trim();


    const fullAddress =
      [
        address,
        city,
        state,
        pincode
      ]
        .filter(Boolean)
        .join(", ");


    const items =
      cart.map(item => ({

        productId:
          products[item.i]
            .backendId,

        qty:
          item.q

      }));


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

              customerName,

              customerEmail:
                user.email,

              phone,

              address:
                fullAddress,

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


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Could not place order"
        );

      }


      /*
        Clear cart after
        successful order.
      */

      localStorage.removeItem(
        "zevoriaCart"
      );

      cart = [];


      /* =========================
         SUCCESS
      ========================= */

      showSuccess(
        data.orderId,
        data.total
      );


    } catch (error) {

      alert(
        "Order could not be placed.\n\n" +
        error.message
      );

    } finally {

      submitButton.disabled =
        false;

      submitButton.textContent =
        originalText;

    }

  }
);


/* =========================
   SUCCESS MODAL
========================= */

function showSuccess(
  orderId,
  total
) {

  const modal =
    document.querySelector(
      "#successModal"
    );


  if (!modal) {

    alert(
      "Order placed successfully!\n\n" +
      "Order #" +
      orderId +
      "\n" +
      "Total: " +
      money(total)
    );

    window.location.href =
      "index.html";

    return;

  }


  const orderNumber =
    modal.querySelector(
      "#successOrderId"
    );


  const orderTotal =
    modal.querySelector(
      "#successTotal"
    );


  if (orderNumber) {

    orderNumber.textContent =
      "#" + orderId;

  }


  if (orderTotal) {

    orderTotal.textContent =
      money(total);

  }


  modal.classList.add(
    "show"
  );

}


/* =========================
   CONTINUE SHOPPING
========================= */

const continueShopping =
  document.querySelector(
    "#continueShopping"
  );


if (continueShopping) {

  continueShopping.onclick =
    () => {

      window.location.href =
        "index.html";

    };

}


/* =========================
   SUCCESS CLOSE
========================= */

const successClose =
  document.querySelector(
    "#successClose"
  );


if (successClose) {

  successClose.onclick =
    () => {

      window.location.href =
        "index.html";

    };

}

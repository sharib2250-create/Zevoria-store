const API_BASE = "https://zevoria-backend.onrender.com";

const CART_KEY = "zevoriaCart";
const USER_KEY = "zevoriaUser";
const ORDERS_KEY = "zevoriaOrders";

const cart = JSON.parse(
  localStorage.getItem(CART_KEY) || "[]"
);


/* =========================================================
   PRODUCT DATA
========================================================= */

const products = [
  {
    id: 1,
    name: "No. 01 Noir",
    category: "men",
    price: 1499,
    note: "Amber • Oud • Vanilla"
  },

  {
    id: 2,
    name: "No. 02 Santal",
    category: "unisex",
    price: 1699,
    note: "Sandalwood • Musk • Cedar"
  },

  {
    id: 3,
    name: "No. 03 Bloom",
    category: "women",
    price: 1399,
    note: "Rose • Peony • Vanilla"
  },

  {
    id: 4,
    name: "No. 04 Oud",
    category: "unisex",
    price: 899,
    note: "Oud • Saffron • Amber"
  },

  {
    id: 5,
    name: "No. 05 Azure",
    category: "men",
    price: 1599,
    note: "Bergamot • Marine • Musk"
  },

  {
    id: 6,
    name: "No. 06 Velvet",
    category: "women",
    price: 1499,
    note: "Iris • Tonka • Amber"
  }
];


/* =========================================================
   DOM
========================================================= */

const checkoutForm =
  document.getElementById("checkoutForm");

const checkoutItems =
  document.getElementById("checkoutItems");

const subtotalEl =
  document.getElementById("checkoutSubtotal");

const deliveryEl =
  document.getElementById("checkoutDelivery");

const totalEl =
  document.getElementById("checkoutTotal");

const successModal =
  document.getElementById("successModal");

const successOrderNumber =
  document.getElementById("successOrderNumber");

const successTotal =
  document.getElementById("successTotal");

const continueShoppingBtn =
  document.getElementById("continueShopping");

const trackOrderBtn =
  document.getElementById("trackOrderBtn");


/* =========================================================
   HELPERS
========================================================= */

function money(value) {

  return `₹${Number(value).toLocaleString("en-IN")}`;

}


function getCartProducts() {

  return cart
    .map((item) => {

      const product =
        products.find(
          (p) =>
            p.id === Number(item.i)
        );

      if (!product) {
        return null;
      }

      return {

        ...product,

        qty:
          Number(item.q) || 1

      };

    })
    .filter(Boolean);

}


function calculateSubtotal() {

  return getCartProducts()
    .reduce(
      (sum, product) =>
        sum +
        product.price *
        product.qty,

      0
    );

}


/* =========================================================
   RENDER CHECKOUT
========================================================= */

function renderCheckout() {

  const items =
    getCartProducts();


  if (
    !checkoutItems
  ) {
    return;
  }


  if (
    items.length === 0
  ) {

    checkoutItems.innerHTML = `

      <div class="empty-checkout">

        <p>
          Your bag is empty.
        </p>

        <a href="index.html">
          Continue Shopping
        </a>

      </div>

    `;

    if (subtotalEl) {
      subtotalEl.textContent =
        money(0);
    }

    if (deliveryEl) {
      deliveryEl.textContent =
        "FREE";
    }

    if (totalEl) {
      totalEl.textContent =
        money(0);
    }

    return;
  }


  checkoutItems.innerHTML =
    items
      .map(
        (product) => `

          <div
            class="checkout-product"
          >

            <div
              class="checkout-product-image"
            >
              <div
                class="checkout-mini-bottle"
              ></div>
            </div>


            <div
              class="checkout-product-info"
            >

              <h3>
                ${product.name}
              </h3>

              <p>
                ${product.note}
              </p>

              <span>
                Qty: ${product.qty}
              </span>

            </div>


            <strong>
              ${money(
                product.price *
                product.qty
              )}
            </strong>

          </div>

        `
      )
      .join("");


  const subtotal =
    calculateSubtotal();


  const delivery = 0;


  const total =
    subtotal +
    delivery;


  if (subtotalEl) {

    subtotalEl.textContent =
      money(subtotal);

  }


  if (deliveryEl) {

    deliveryEl.textContent =
      delivery === 0
        ? "FREE"
        : money(delivery);

  }


  if (totalEl) {

    totalEl.textContent =
      money(total);

  }

}


/* =========================================================
   PREFILL USER DETAILS
========================================================= */

function prefillUser() {

  const savedUser =
    JSON.parse(
      localStorage.getItem(
        USER_KEY
      ) || "null"
    );


  if (!savedUser) {
    return;
  }


  const nameInput =
    document.getElementById(
      "fullName"
    );

  const emailInput =
    document.getElementById(
      "email"
    );

  const phoneInput =
    document.getElementById(
      "phone"
    );


  if (
    nameInput &&
    savedUser.name
  ) {

    nameInput.value =
      savedUser.name;

  }


  if (
    emailInput &&
    savedUser.email
  ) {

    emailInput.value =
      savedUser.email;

  }


  if (
    phoneInput &&
    savedUser.phone
  ) {

    phoneInput.value =
      savedUser.phone;

  }

}


/* =========================================================
   SAVE ORDER LOCALLY
========================================================= */

function saveOrderHistory(order) {

  const existingOrders =
    JSON.parse(
      localStorage.getItem(
        ORDERS_KEY
      ) || "[]"
    );


  /*
    Never delete previous orders.
    New orders are added to the beginning.
  */

  existingOrders.unshift(order);


  localStorage.setItem(
    ORDERS_KEY,
    JSON.stringify(
      existingOrders
    )
  );


  /*
    Also allow app.js to use the
    order later if needed.
  */

  window.zevoriaOrders =
    existingOrders;

}


/* =========================================================
   FORM SUBMISSION
========================================================= */

if (checkoutForm) {

  checkoutForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (
        cart.length === 0
      ) {

        alert(
          "Your bag is empty."
        );

        return;

      }


      const submitButton =
        checkoutForm.querySelector(
          'button[type="submit"]'
        );


      if (submitButton) {

        submitButton.disabled =
          true;

        submitButton.textContent =
          "Placing Order...";

      }


      try {

        const fullName =
          document
            .getElementById(
              "fullName"
            )
            ?.value
            .trim();


        const email =
          document
            .getElementById(
              "email"
            )
            ?.value
            .trim();


        const phone =
          document
            .getElementById(
              "phone"
            )
            ?.value
            .trim();


        const address =
          document
            .getElementById(
              "address"
            )
            ?.value
            .trim();


        const city =
          document
            .getElementById(
              "city"
            )
            ?.value
            .trim();


        const state =
          document
            .getElementById(
              "state"
            )
            ?.value
            .trim();


        const pincode =
          document
            .getElementById(
              "pincode"
            )
            ?.value
            .trim();


        /* =================================================
           VALIDATION
        ================================================= */

        if (!fullName) {

          throw new Error(
            "Please enter your full name."
          );

        }


        if (!email) {

          throw new Error(
            "Please enter your email address."
          );

        }


        if (!phone) {

          throw new Error(
            "Please enter your phone number."
          );

        }


        if (!address) {

          throw new Error(
            "Please enter your delivery address."
          );

        }


        if (!city) {

          throw new Error(
            "Please enter your city."
          );

        }


        if (!state) {

          throw new Error(
            "Please enter your state."
          );

        }


        if (!pincode) {

          throw new Error(
            "Please enter your pincode."
          );

        }


        const emailPattern =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
          !emailPattern.test(
            email
          )
        ) {

          throw new Error(
            "Please enter a valid email address."
          );

        }


        const phoneDigits =
          phone.replace(
            /\D/g,
            ""
          );


        if (
          phoneDigits.length <
          10
        ) {

          throw new Error(
            "Please enter a valid phone number."
          );

        }


        if (
          !/^\d{6}$/.test(
            pincode
          )
        ) {

          throw new Error(
            "Please enter a valid 6-digit pincode."
          );

        }


        /* =================================================
           CREATE BACKEND ITEMS
        ================================================= */

        const orderItems =
          cart.map(
            (item) => ({

              productId:
                Number(item.i),

              qty:
                Number(item.q) || 1

            })
          );


        const fullAddress = [

          address,

          city,

          state,

          pincode

        ]
          .filter(Boolean)
          .join(", ");


        /* =================================================
           SEND ORDER
        ================================================= */

        const response =
          await fetch(
            `${API_BASE}/api/orders`,
            {

              method:
                "POST",

              headers: {

                "Content-Type":
                  "application/json"

              },

              body:
                JSON.stringify({

                  customerName:
                    fullName,

                  customerEmail:
                    email,

                  phone:
                    phone,

                  address:
                    fullAddress,

                  items:
                    orderItems

                })

            }
          );


        const result =
          await response.json();


        if (
          !response.ok
        ) {

          throw new Error(
            result.error ||
            "Could not place your order."
          );

        }


        /* =================================================
           CHECK PRIVATE ORDER TOKEN
        ================================================= */

        if (
          !result.orderToken
        ) {

          throw new Error(
            "Order was created, but tracking access could not be generated."
          );

        }


        /* =================================================
           SAVE ORDER HISTORY
        ================================================= */

        const orderRecord = {

          orderId:
            result.orderId,

          orderToken:
            result.orderToken,

          total:
            result.total,

          paymentMethod:
            "COD",

          customerName:
            fullName,

          customerEmail:
            email,

          phone:
            phone,

          address:
            fullAddress,

          items:
            orderItems,

          status:
            "pending",

          createdAt:
            new Date().toISOString()

        };


        saveOrderHistory(
          orderRecord
        );


        /* =================================================
           CLEAR CART
        ================================================= */

        localStorage.removeItem(
          CART_KEY
        );


        /* Keep global cart empty */

        window.zevoriaCart =
          [];


        /* =================================================
           SHOW SUCCESS
        ================================================= */

        if (
          successOrderNumber
        ) {

          successOrderNumber.textContent =
            `#${result.orderId}`;

        }


        if (
          successTotal
        ) {

          successTotal.textContent =
            money(
              result.total
            );

        }


        if (
          successModal
        ) {

          successModal.classList.add(
            "open"
          );

        } else {

          alert(
            `Order #${result.orderId} placed successfully!`
          );

        }


        /*
          Save currently selected order
          for tracking button.
        */

        window.currentZevoriaOrder =
          orderRecord;


      } catch (error) {

        console.error(
          "Checkout error:",
          error
        );


        alert(
          error.message ||
          "Something went wrong while placing your order."
        );


      } finally {

        if (submitButton) {

          submitButton.disabled =
            false;

          submitButton.textContent =
            "Place Order — Cash on Delivery";

        }

      }

    }
  );

}


/* =========================================================
   TRACK ORDER BUTTON
========================================================= */

if (trackOrderBtn) {

  trackOrderBtn.addEventListener(
    "click",
    () => {

      const order =
        window.currentZevoriaOrder;


      if (!order) {

        return;

      }


      /*
        Store the selected order so
        index.html/app.js can open tracking.
      */

      localStorage.setItem(
        "zevoriaSelectedOrder",
        JSON.stringify(
          order
        )
      );


      /*
        Return to main website.
        app.js can read the selected
        order and open tracking.
      */

      window.location.href =
        "index.html?track=" +
        encodeURIComponent(
          order.orderId
        );

    }
  );

}


/* =========================================================
   CONTINUE SHOPPING
========================================================= */

if (
  continueShoppingBtn
) {

  continueShoppingBtn.addEventListener(
    "click",
    () => {

      window.location.href =
        "index.html";

    }
  );

}


/* =========================================================
   INITIALIZE
========================================================= */

prefillUser();

renderCheckout();

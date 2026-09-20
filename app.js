/* =========================================================
   ZEVORIA — APP.JS
   ========================================================= */

const API_BASE = "https://zevoria-backend.onrender.com";


/* =========================================================
   PRODUCTS
   ========================================================= */

const products = [
  {
    id: 0,
    backendId: 1,
    name: "No. 01 Noir",
    category: "men",
    type: "Eau de Parfum",
    price: 1499,
    notes: "Amber • Oud • Vanilla"
  },
  {
    id: 1,
    backendId: 2,
    name: "No. 02 Santal",
    category: "unisex",
    type: "Eau de Parfum",
    price: 1699,
    notes: "Sandalwood • Musk • Cedar"
  },
  {
    id: 2,
    backendId: 3,
    name: "No. 03 Bloom",
    category: "women",
    type: "Eau de Parfum",
    price: 1399,
    notes: "Rose • Peony • Vanilla"
  },
  {
    id: 3,
    backendId: 4,
    name: "No. 04 Oud",
    category: "unisex",
    type: "Attar",
    price: 899,
    notes: "Oud • Saffron • Amber"
  },
  {
    id: 4,
    backendId: 5,
    name: "No. 05 Azure",
    category: "men",
    type: "Eau de Parfum",
    price: 1599,
    notes: "Bergamot • Marine • Musk"
  },
  {
    id: 5,
    backendId: 6,
    name: "No. 06 Velvet",
    category: "women",
    type: "Eau de Parfum",
    price: 1499,
    notes: "Iris • Tonka • Amber"
  }
];


/* =========================================================
   LOCAL STORAGE KEYS
   ========================================================= */

const CART_KEY = "zevoriaCart";
const USER_KEY = "zevoriaUser";
const WISHLIST_KEY = "zevoriaWishlist";
const ORDERS_KEY = "zevoriaOrders";
const REVIEWS_KEY = "zevoriaReviews";
const SEARCH_KEY = "zevoriaRecentSearches";
const THEME_KEY = "zevoriaTheme";
const COUPON_KEY = "zevoriaCoupon";


/* =========================================================
   STATE
   ========================================================= */

let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

let wishlist = JSON.parse(
  localStorage.getItem(WISHLIST_KEY) || "[]"
);

let recentSearches = JSON.parse(
  localStorage.getItem(SEARCH_KEY) || "[]"
);

let currentFilter = "all";

let currentSearch = "";

let currentSort = "default";

let appliedCoupon = JSON.parse(
  localStorage.getItem(COUPON_KEY) || "null"
);


/* =========================================================
   HELPERS
   ========================================================= */

function money(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}


function saveCart() {
  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart)
  );
}


function saveWishlist() {
  localStorage.setItem(
    WISHLIST_KEY,
    JSON.stringify(wishlist)
  );
}


function saveOrders(orders) {
  localStorage.setItem(
    ORDERS_KEY,
    JSON.stringify(orders)
  );
}


function getOrders() {
  return JSON.parse(
    localStorage.getItem(ORDERS_KEY) || "[]"
  );
}


function getProduct(id) {
  return products.find(
    p => p.id === Number(id)
  );
}


function getProductByBackendId(id) {
  return products.find(
    p => p.backendId === Number(id)
  );
}


function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer;

function toast(message) {

  const el = document.getElementById("toast");

  if (!el) return;

  el.textContent = message;

  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2800);
}


/* =========================================================
   MODAL SYSTEM
   ========================================================= */

const overlay = document.getElementById("overlay");


function openModal(id) {

  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.add("show");

  overlay?.classList.add("show");

  document.body.style.overflow = "hidden";
}


function closeModal(id) {

  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.remove("show");

  const anyModalOpen =
    document.querySelector(".modal.show");

  const drawerOpen =
    document.getElementById("cartDrawer")
      ?.classList.contains("open");

  if (!anyModalOpen && !drawerOpen) {
    overlay?.classList.remove("show");
    document.body.style.overflow = "";
  }
}


function closeAll() {

  document
    .querySelectorAll(".modal.show")
    .forEach(modal => {
      modal.classList.remove("show");
    });

  document
    .getElementById("cartDrawer")
    ?.classList.remove("open");

  overlay?.classList.remove("show");

  document.body.style.overflow = "";
}


document
  .querySelectorAll("[data-close]")
  .forEach(button => {

    button.addEventListener("click", closeAll);

  });


overlay?.addEventListener("click", closeAll);


document.addEventListener("keydown", event => {

  if (event.key === "Escape") {
    closeAll();
  }

});


/* =========================================================
   CART
   ========================================================= */

function addToCart(productId, quantity = 1) {

  const product = getProduct(productId);

  if (!product) return;

  const existing = cart.find(
    item => item.i === product.id
  );

  if (existing) {

    existing.q += quantity;

  } else {

    cart.push({
      i: product.id,
      q: quantity
    });

  }

  saveCart();

  renderCart();

  updateCounts();

  toast(`${product.name} added to your bag.`);
}


function changeQty(productId, amount) {

  const item = cart.find(
    item => item.i === Number(productId)
  );

  if (!item) return;

  item.q += amount;

  if (item.q <= 0) {

    cart = cart.filter(
      x => x.i !== Number(productId)
    );

  }

  saveCart();

  renderCart();

  updateCounts();
}


function removeFromCart(productId) {

  cart = cart.filter(
    item => item.i !== Number(productId)
  );

  saveCart();

  renderCart();

  updateCounts();

  toast("Item removed from your bag.");
}


function cartSubtotal() {

  return cart.reduce((sum, item) => {

    const product = getProduct(item.i);

    if (!product) return sum;

    return sum + product.price * item.q;

  }, 0);
}


function calculateDiscount(subtotal) {

  if (!appliedCoupon) {
    return 0;
  }

  if (appliedCoupon.type === "percent") {

    return Math.round(
      subtotal * appliedCoupon.value / 100
    );

  }

  if (appliedCoupon.type === "fixed") {

    return Math.min(
      appliedCoupon.value,
      subtotal
    );

  }

  return 0;
}


function cartTotal() {

  const subtotal = cartSubtotal();

  return subtotal - calculateDiscount(subtotal);
}


/* =========================================================
   RENDER CART
   ========================================================= */

function renderCart() {

  const container =
    document.getElementById("cartItems");

  if (!container) return;

  if (!cart.length) {

    container.innerHTML = `
      <div class="empty-products">
        <h3>Your bag is empty</h3>
        <p>Discover something you will love.</p>
      </div>
    `;

    updateCartTotals();

    return;
  }


  container.innerHTML = cart.map(item => {

    const product = getProduct(item.i);

    if (!product) return "";

    return `
      <div class="cart-item">

        <div class="cart-item-image">
          <div class="mini-bottle"></div>
        </div>

        <div class="cart-item-info">

          <h4>
            ${escapeHTML(product.name)}
          </h4>

          <p>
            ${escapeHTML(product.type)}
          </p>

          <div class="qty">

            <button
              type="button"
              onclick="changeQty(${product.id}, -1)"
            >
              −
            </button>

            <span>
              ${item.q}
            </span>

            <button
              type="button"
              onclick="changeQty(${product.id}, 1)"
            >
              +
            </button>

          </div>

          <button
            class="remove-cart"
            onclick="removeFromCart(${product.id})"
          >
            Remove
          </button>

        </div>

        <div class="cart-price">
          ${money(product.price * item.q)}
        </div>

      </div>
    `;

  }).join("");


  updateCartTotals();
}


function updateCartTotals() {

  const subtotal = cartSubtotal();

  const discount = calculateDiscount(subtotal);

  const total = subtotal - discount;


  const subtotalEl =
    document.getElementById("subtotal");

  const totalEl =
    document.getElementById("cartTotal");

  const discountRow =
    document.getElementById("discountRow");

  const discountEl =
    document.getElementById("discountAmount");


  if (subtotalEl) {
    subtotalEl.textContent = money(subtotal);
  }

  if (totalEl) {
    totalEl.textContent = money(total);
  }


  if (
    discountRow &&
    discountEl
  ) {

    if (discount > 0) {

      discountRow.style.display = "flex";

      discountEl.textContent =
        `-${money(discount)}`;

    } else {

      discountRow.style.display = "none";

    }

  }
}


/* =========================================================
   CART DRAWER
   ========================================================= */

function openCart() {

  renderCart();

  document
    .getElementById("cartDrawer")
    ?.classList.add("open");

  overlay?.classList.add("show");

  document.body.style.overflow = "hidden";
}


document
  .getElementById("cartBtn")
  ?.addEventListener("click", openCart);


/* =========================================================
   COUNTS
   ========================================================= */

function updateCounts() {

  const cartCount =
    cart.reduce(
      (sum, item) => sum + item.q,
      0
    );

  const wishlistCount =
    wishlist.length;


  const cartEl =
    document.getElementById("cartCount");

  const wishEl =
    document.getElementById("wishlistCount");


  if (cartEl) {
    cartEl.textContent = cartCount;
  }

  if (wishEl) {
    wishEl.textContent = wishlistCount;
  }
}


/* =========================================================
   PRODUCT FILTER + SEARCH + SORT
   ========================================================= */

function getVisibleProducts() {

  let list = [...products];


  if (currentFilter !== "all") {

    list = list.filter(
      product =>
        product.category === currentFilter
    );

  }


  if (currentSearch.trim()) {

    const query =
      currentSearch
        .toLowerCase()
        .trim();

    list = list.filter(product => {

      const searchable = [
        product.name,
        product.category,
        product.type,
        product.notes
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);

    });

  }


  if (currentSort === "low") {

    list.sort(
      (a, b) => a.price - b.price
    );

  }

  if (currentSort === "high") {

    list.sort(
      (a, b) => b.price - a.price
    );

  }

  if (currentSort === "name") {

    list.sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );

  }


  return list;
}


/* =========================================================
   PRODUCT CARD
   ========================================================= */

function productCard(product) {

  const wished =
    wishlist.includes(product.id);


  return `
    <article
      class="product-card"
      data-product="${product.id}"
    >

      <div class="product-image">

        <div class="product-bottle">
          <div class="product-label"></div>
        </div>


        <div class="product-actions">

          <button
            class="product-icon ${wished ? "wish-active" : ""}"
            onclick="toggleWishlist(${product.id})"
            aria-label="Wishlist"
            title="Wishlist"
          >

            <i
              data-lucide="heart"
              ${wished ? 'fill="currentColor"' : ""}
            ></i>

          </button>


          <button
            class="product-icon"
            onclick="quickView(${product.id})"
            aria-label="Quick view"
            title="Quick view"
          >

            <i data-lucide="eye"></i>

          </button>

        </div>

      </div>


      <div class="product-info">

        <span class="product-category">
          ${escapeHTML(product.category)}
        </span>

        <h3>
          ${escapeHTML(product.name)}
        </h3>

        <p class="product-note">
          ${escapeHTML(product.notes)}
        </p>


        <div class="product-bottom">

          <span class="product-price">
            ${money(product.price)}
          </span>


          <div class="product-buttons">

            <button
              class="quick-btn"
              onclick="quickView(${product.id})"
            >
              Quick view
            </button>

            <button
              class="add-btn"
              onclick="addToCart(${product.id})"
            >
              Add
            </button>

          </div>

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   RENDER PRODUCTS
   ========================================================= */

function renderProducts() {

  const container =
    document.getElementById("products");

  if (!container) return;


  const list =
    getVisibleProducts();


  if (!list.length) {

    container.innerHTML = `
      <div class="empty-products">

        <h3>
          No fragrance found
        </h3>

        <p>
          Try another search or category.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    list.map(productCard).join("");


  refreshIcons();
}


function refreshIcons() {

  if (window.lucide) {
    lucide.createIcons();
  }

}


/* =========================================================
   FILTER BUTTONS
   ========================================================= */

document
  .querySelectorAll(".filter")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".filter")
          .forEach(btn =>
            btn.classList.remove("active")
          );

        button.classList.add("active");

        currentFilter =
          button.dataset.filter;

        renderProducts();

      }
    );

  });


/* =========================================================
   SHOP SEARCH
   ========================================================= */

const shopSearch =
  document.getElementById("shopSearch");


shopSearch?.addEventListener(
  "input",
  event => {

    currentSearch =
      event.target.value;

    renderProducts();

  }
);


/* =========================================================
   SORT
   ========================================================= */

document
  .getElementById("sortBtn")
  ?.addEventListener(
    "click",
    () => {

      if (currentSort === "default") {

        currentSort = "low";

        toast("Sorted by lowest price.");

      } else if (currentSort === "low") {

        currentSort = "high";

        toast("Sorted by highest price.");

      } else if (currentSort === "high") {

        currentSort = "name";

        toast("Sorted alphabetically.");

      } else {

        currentSort = "default";

        toast("Default sorting restored.");

      }

      renderProducts();

    }
  );


/* =========================================================
   ADVANCED SEARCH MODAL
   ========================================================= */

document
  .getElementById("searchBtn")
  ?.addEventListener(
    "click",
    () => {

      openModal("searchModal");

      setTimeout(() => {

        document
          .getElementById("searchInput")
          ?.focus();

      }, 100);

      renderSearchResults("");

    }
  );


const searchInput =
  document.getElementById("searchInput");


searchInput?.addEventListener(
  "input",
  event => {

    const query =
      event.target.value;

    renderSearchResults(query);

  }
);


function renderSearchResults(query) {

  const container =
    document.getElementById("searchResults");

  if (!container) return;


  const q =
    query.trim().toLowerCase();


  let list =
    products.filter(product => {

      if (!q) return true;

      const searchable = [
        product.name,
        product.category,
        product.type,
        product.notes
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);

    });


  if (!list.length) {

    container.innerHTML = `
      <p class="muted">
        No fragrances match your search.
      </p>
    `;

    return;
  }


  container.innerHTML =
    list.map(product => `

      <div
        class="search-result"
        onclick="quickView(${product.id})"
      >

        <div class="search-result-bottle"></div>

        <div class="search-result-info">

          <strong>
            ${escapeHTML(product.name)}
          </strong>

          <small>
            ${escapeHTML(product.type)}
            •
            ${escapeHTML(product.notes)}
          </small>

        </div>

        <strong>
          ${money(product.price)}
        </strong>

      </div>

    `).join("");


  if (q) {

    recentSearches =
      recentSearches.filter(
        x => x !== q
      );

    recentSearches.unshift(q);

    recentSearches =
      recentSearches.slice(0, 8);

    localStorage.setItem(
      SEARCH_KEY,
      JSON.stringify(recentSearches)
    );

  }

}


/* =========================================================
   QUICK VIEW
   ========================================================= */

function quickView(productId) {

  const product =
    getProduct(productId);

  if (!product) return;


  const wished =
    wishlist.includes(product.id);


  const container =
    document.getElementById(
      "quickViewContent"
    );

  if (!container) return;


  container.innerHTML = `

    <div class="quick-view-image">

      <div class="product-bottle">
        <div class="product-label"></div>
      </div>

    </div>


    <div class="quick-view-info">

      <span class="category">
        ${escapeHTML(product.type)}
      </span>

      <h2>
        ${escapeHTML(product.name)}
      </h2>

      <div class="price">
        ${money(product.price)}
      </div>


      <p class="description">
        A carefully composed ZEVORIA fragrance
        designed to become part of your everyday signature.
      </p>


      <div class="notes">

        ${product.notes
          .split("•")
          .map(note =>
            `<span class="note">
              ${escapeHTML(note.trim())}
            </span>`
          )
          .join("")}

      </div>


      <div class="quick-view-buttons">

        <button
          class="btn btn-dark"
          onclick="addToCart(${product.id}); closeModal('quickViewModal')"
        >
          Add to bag
          <i data-lucide="shopping-bag"></i>
        </button>


        <button
          class="btn"
          onclick="toggleWishlist(${product.id})"
        >
          <i
            data-lucide="heart"
            ${wished ? 'fill="currentColor"' : ""}
          ></i>

          ${wished ? "Saved" : "Wishlist"}

        </button>

      </div>

    </div>

  `;


  openModal("quickViewModal");

  refreshIcons();
}


/* =========================================================
   WISHLIST
   ========================================================= */

function toggleWishlist(productId) {

  productId = Number(productId);


  if (wishlist.includes(productId)) {

    wishlist =
      wishlist.filter(
        id => id !== productId
      );

    toast("Removed from wishlist.");

  } else {

    wishlist.push(productId);

    toast("Saved to your wishlist.");

  }


  saveWishlist();

  updateCounts();

  renderProducts();

  renderWishlist();

}


function renderWishlist() {

  const container =
    document.getElementById(
      "wishlistItems"
    );

  if (!container) return;


  if (!wishlist.length) {

    container.innerHTML = `
      <div class="empty-products">

        <h3>
          Your wishlist is empty
        </h3>

        <p>
          Save fragrances here for later.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    wishlist.map(id => {

      const product =
        getProduct(id);

      if (!product) return "";

      return `

        <div class="wishlist-card">

          <div class="wishlist-card-image">

            <div class="product-bottle">
              <div class="product-label"></div>
            </div>

          </div>

          <h4>
            ${escapeHTML(product.name)}
          </h4>

          <div class="wishlist-card-price">
            ${money(product.price)}
          </div>


          <div class="wishlist-card-actions">

            <button
              onclick="addToCart(${product.id})"
            >
              Add to bag
            </button>

            <button
              onclick="toggleWishlist(${product.id})"
            >
              Remove
            </button>

          </div>

        </div>

      `;

    }).join("");
}


document
  .getElementById("wishlistBtn")
  ?.addEventListener(
    "click",
    () => {

      renderWishlist();

      openModal("wishlistModal");

    }
  );


document
  .getElementById("viewWishlistBtn")
  ?.addEventListener(
    "click",
    () => {

      closeModal("accountModal");

      renderWishlist();

      openModal("wishlistModal");

    }
  );


/* =========================================================
   SCENT FINDER
   ========================================================= */

const scentMap = {

  fresh: [4, 1],

  woody: [1, 3],

  sweet: [2, 5, 0],

  dark: [0, 3],

  floral: [2, 5],

  oud: [3, 0]

};


function openScentFinder() {

  openModal("scentFinderModal");

  const result =
    document.getElementById(
      "scentResult"
    );

  if (result) {
    result.style.display = "none";
  }

}


document
  .getElementById("scentFinderBtn")
  ?.addEventListener(
    "click",
    openScentFinder
  );


document
  .getElementById("openScentFinder")
  ?.addEventListener(
    "click",
    openScentFinder
  );


document
  .querySelectorAll(".scent-option")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const type =
          button.dataset.scent;

        showScentResult(type);

      }
    );

  });


function showScentResult(type) {

  const result =
    document.getElementById(
      "scentResult"
    );

  if (!result) return;


  const ids =
    scentMap[type] || [0];


  const recommended =
    ids
      .map(id => getProduct(id))
      .filter(Boolean);


  const main =
    recommended[0];


  result.style.display = "block";


  result.innerHTML = `

    <span class="eyebrow">
      YOUR ZEVORIA MATCH
    </span>

    <h4>
      ${escapeHTML(main.name)}
    </h4>

    <p>
      ${escapeHTML(main.notes)}
    </p>

    <button
      class="btn btn-dark"
      onclick="quickView(${main.id})"
    >
      Explore ${escapeHTML(main.name)}
      <i data-lucide="arrow-right"></i>
    </button>

  `;


  refreshIcons();

}


/* =========================================================
   COUPONS
   ========================================================= */

/*
  These coupons currently work for the cart display.

  IMPORTANT:
  The current Render backend calculates the order total
  itself and does not yet receive coupon information.

  Therefore the coupon shown here is a frontend preview.
  We will connect the discount to the server-side order
  calculation when checkout/backend is upgraded.
*/

const coupons = {

  ZEVORIA10: {
    type: "percent",
    value: 10
  },

  WELCOME15: {
    type: "percent",
    value: 15
  },

  NOIR100: {
    type: "fixed",
    value: 100
  }

};


document
  .getElementById("applyCouponBtn")
  ?.addEventListener(
    "click",
    applyCoupon
  );


function applyCoupon() {

  const input =
    document.getElementById(
      "couponInput"
    );

  const message =
    document.getElementById(
      "couponMessage"
    );


  if (!input || !message) return;


  const code =
    input.value
      .trim()
      .toUpperCase();


  if (!code) {

    message.textContent =
      "Enter a coupon code.";

    message.className = "error";

    return;

  }


  const coupon =
    coupons[code];


  if (!coupon) {

    message.textContent =
      "Invalid coupon code.";

    message.className = "error";

    appliedCoupon = null;

    localStorage.removeItem(
      COUPON_KEY
    );

    updateCartTotals();

    return;

  }


  appliedCoupon = {
    code,
    type: coupon.type,
    value: coupon.value
  };


  localStorage.setItem(
    COUPON_KEY,
    JSON.stringify(appliedCoupon)
  );


  message.textContent =
    `${code} applied successfully.`;

  message.className = "success";


  updateCartTotals();

  toast("Coupon applied.");
}


/* =========================================================
   ACCOUNT
   ========================================================= */

function getUser() {

  return JSON.parse(
    localStorage.getItem(USER_KEY) || "null"
  );

}


function updateAccountUI() {

  const user =
    getUser();


  const loggedOut =
    document.getElementById(
      "loggedOutAccount"
    );

  const loggedIn =
    document.getElementById(
      "loggedInAccount"
    );


  if (!loggedOut || !loggedIn) return;


  if (user) {

    loggedOut.style.display = "none";

    loggedIn.style.display = "block";


    const name =
      document.getElementById(
        "accountName"
      );

    const email =
      document.getElementById(
        "accountEmail"
      );

    const phone =
      document.getElementById(
        "accountPhone"
      );


    if (name) name.textContent = user.name || "";

    if (email) email.textContent = user.email || "";

    if (phone) phone.textContent = user.phone || "";

  } else {

    loggedOut.style.display = "block";

    loggedIn.style.display = "none";

  }

}


document
  .getElementById("accountBtn")
  ?.addEventListener(
    "click",
    () => {

      updateAccountUI();

      openModal("accountModal");

    }
  );


/* =========================================================
   LOGIN
   ========================================================= */

document
  .getElementById("loginForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const email =
        document
          .getElementById("loginEmail")
          .value
          .trim();

      const password =
        document
          .getElementById("loginPassword")
          .value;


      try {

        const response =
          await fetch(
            `${API_BASE}/api/auth/login`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                email,
                password
              })
            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.message ||
            data.error ||
            "Login failed."
          );

        }


        localStorage.setItem(
          USER_KEY,
          JSON.stringify(data.user)
        );


        updateAccountUI();

        toast("Welcome back to ZEVORIA.");

      } catch (error) {

        toast(
          error.message ||
          "Unable to sign in."
        );

      }

    }
  );


/* =========================================================
   SIGNUP
   ========================================================= */

document
  .getElementById("signupForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const name =
        document
          .getElementById("signupName")
          .value
          .trim();

      const email =
        document
          .getElementById("signupEmail")
          .value
          .trim();

      const phone =
        document
          .getElementById("signupPhone")
          .value
          .trim();

      const password =
        document
          .getElementById("signupPassword")
          .value;


      try {

        const response =
          await fetch(
            `${API_BASE}/api/auth/signup`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                name,
                email,
                phone,
                password
              })
            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.message ||
            data.error ||
            "Account creation failed."
          );

        }


        localStorage.setItem(
          USER_KEY,
          JSON.stringify(data.user)
        );


        updateAccountUI();

        toast(
          "Your ZEVORIA account has been created."
        );


      } catch (error) {

        toast(
          error.message ||
          "Unable to create account."
        );

      }

    }
  );


/* =========================================================
   LOGIN / SIGNUP SWITCH
   ========================================================= */

document
  .getElementById("showSignupBtn")
  ?.addEventListener(
    "click",
    () => {

      document
        .getElementById("loginForm")
        .style.display = "none";

      document
        .getElementById("showSignupBtn")
        .style.display = "none";

      document
        .getElementById("signupForm")
        .style.display = "block";

    }
  );


document
  .getElementById("showLoginBtn")
  ?.addEventListener(
    "click",
    () => {

      document
        .getElementById("signupForm")
        .style.display = "none";

      document
        .getElementById("loginForm")
        .style.display = "block";

      document
        .getElementById("showSignupBtn")
        .style.display = "block";

    }
  );


/* =========================================================
   LOGOUT
   ========================================================= */

document
  .getElementById("logoutBtn")
  ?.addEventListener(
    "click",
    () => {

      localStorage.removeItem(
        USER_KEY
      );

      updateAccountUI();

      toast("You have been signed out.");

    }
  );


/* =========================================================
   MOBILE MENU
   ========================================================= */

document
  .getElementById("menuBtn")
  ?.addEventListener(
    "click",
    () => {

      document
        .getElementById("nav")
        ?.classList.toggle("open");

    }
  );


document
  .querySelectorAll(".nav a")
  .forEach(link => {

    link.addEventListener(
      "click",
      () => {

        document
          .getElementById("nav")
          ?.classList.remove("open");

      }
    );

  });


/* =========================================================
   ATTAR BUTTON
   ========================================================= */

document
  .getElementById("attarBtn")
  ?.addEventListener(
    "click",
    () => {

      currentFilter = "unisex";

      currentSearch = "";

      if (shopSearch) {
        shopSearch.value = "";
      }


      document
        .querySelectorAll(".filter")
        .forEach(btn =>
          btn.classList.remove("active")
        );


      document
        .querySelector(
          '.filter[data-filter="unisex"]'
        )
        ?.classList.add("active");


      document
        .getElementById("shop")
        ?.scrollIntoView({
          behavior: "smooth"
        });


      renderProducts();

    }
  );


/* =========================================================
   NEWSLETTER
   ========================================================= */

document
  .getElementById("newsletter")
  ?.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      const input =
        event.currentTarget.querySelector(
          "input"
        );

      if (!input) return;


      const email =
        input.value.trim();


      localStorage.setItem(
        "zevoriaNewsletter",
        email
      );


      input.value = "";

      toast(
        "You're on the ZEVORIA list."
      );

    }
  );


/* =========================================================
   CHECKOUT
   ========================================================= */

document
  .getElementById("checkoutBtn")
  ?.addEventListener(
    "click",
    () => {

      if (!cart.length) {

        toast(
          "Your bag is empty."
        );

        return;

      }


      /*
        Checkout remains on the dedicated
        checkout.html page.
      */

      window.location.href =
        "checkout.html";

    }
  );


/* =========================================================
   SAVE ORDER LOCALLY
   ========================================================= */

function saveLocalOrder(orderData) {

  const orders =
    getOrders();


  const exists =
    orders.some(
      order =>
        String(order.orderId) ===
        String(orderData.orderId)
    );


  if (!exists) {

    orders.unshift({
      orderId: orderData.orderId,
      total: orderData.total,
      createdAt:
        orderData.createdAt ||
        new Date().toISOString()
    });


    saveOrders(orders);

  }

}


/* =========================================================
   ORDER HISTORY
   ========================================================= */

document
  .getElementById("viewOrdersBtn")
  ?.addEventListener(
    "click",
    () => {

      closeModal("accountModal");

      renderOrderHistory();

      openModal("ordersModal");

    }
  );


async function renderOrderHistory() {

  const container =
    document.getElementById(
      "ordersList"
    );

  if (!container) return;


  const orders =
    getOrders();


  if (!orders.length) {

    container.innerHTML = `
      <div class="empty-products">

        <h3>
          No orders yet
        </h3>

        <p>
          Your completed orders will appear here.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    orders.map(order => `

      <div class="order-card">

        <div class="order-card-head">

          <div>

            <div class="order-number">
              Order #${escapeHTML(order.orderId)}
            </div>

            <div class="order-date">
              ${formatDate(order.createdAt)}
            </div>

          </div>

          <span class="order-status">
            Saved order
          </span>

        </div>


        <div class="order-total">
          ${money(order.total)}
        </div>


        <div class="order-card-actions">

          <button
            onclick="trackOrder('${escapeHTML(order.orderId)}')"
          >
            Track order
          </button>

          <button
            onclick="reorder('${escapeHTML(order.orderId)}')"
          >
            Reorder
          </button>

        </div>

      </div>

    `).join("");

}


function formatDate(date) {

  if (!date) return "";

  return new Date(date).toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

}


/* =========================================================
   TRACK ORDER
   ========================================================= */

async function trackOrder(orderId) {

  openModal("trackingModal");


  const container =
    document.getElementById(
      "trackingContent"
    );

  if (!container) return;


  container.innerHTML = `
    <p class="muted">
      Loading order information...
    </p>
  `;


  try {

    const response =
      await fetch(
        `${API_BASE}/api/orders/${encodeURIComponent(orderId)}`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.error ||
        "Order not found."
      );

    }


    renderTracking(data);


  } catch (error) {

    container.innerHTML = `

      <div class="empty-products">

        <h3>
          Order not available
        </h3>

        <p>
          ${escapeHTML(error.message)}
        </p>

      </div>

    `;

  }

}


function renderTracking(order) {

  const container =
    document.getElementById(
      "trackingContent"
    );

  if (!container) return;


  const statuses = [
    "pending",
    "confirmed",
    "shipped",
    "delivered"
  ];


  let currentIndex =
    statuses.indexOf(
      String(order.order.status)
        .toLowerCase()
    );


  if (currentIndex < 0) {
    currentIndex = 0;
  }


  const labels = {
    pending: "Order received",
    confirmed: "Order confirmed",
    shipped: "Shipped",
    delivered: "Delivered"
  };


  const descriptions = {
    pending:
      "Your order has been received and is waiting for confirmation.",

    confirmed:
      "Your order has been confirmed and is being prepared.",

    shipped:
      "Your order has been handed over for delivery.",

    delivered:
      "Your order has been delivered."
  };


  container.innerHTML = `

    <span class="eyebrow">
      ORDER TRACKING
    </span>

    <h3 class="tracking-order-number">
      #${escapeHTML(order.order.id)}
    </h3>

    <p class="tracking-total">
      Total: ${money(order.order.total)}
    </p>


    <div class="timeline">

      ${statuses.map(
        (status, index) => `

          <div
            class="timeline-step ${
              index <= currentIndex
                ? "active"
                : ""
            }"
          >

            <div class="timeline-dot">

              ${
                index <= currentIndex
                  ? `<i data-lucide="check"></i>`
                  : ""
              }

            </div>


            <h4>
              ${labels[status]}
            </h4>

            <p>
              ${descriptions[status]}
            </p>

          </div>

        `
      ).join("")}

    </div>


    ${
      order.order.status === "cancelled"
        ? `
          <div class="scent-result">

            <h4>
              Order cancelled
            </h4>

            <p>
              This order has been cancelled.
            </p>

          </div>
        `
        : ""
    }

  `;


  refreshIcons();

}


/* =========================================================
   REORDER
   ========================================================= */

async function reorder(orderId) {

  try {

    const response =
      await fetch(
        `${API_BASE}/api/orders/${encodeURIComponent(orderId)}`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.error ||
        "Unable to load order."
      );

    }


    const items =
      data.items || [];


    let added = 0;


    items.forEach(item => {

      const product =
        getProductByBackendId(
          item.product_id ||
          item.productId
        );


      if (!product) return;


      addToCart(
        product.id,
        Number(item.qty || 1)
      );


      added++;

    });


    if (added) {

      toast(
        "Previous order added to your bag."
      );

      closeAll();

      setTimeout(
        openCart,
        250
      );

    } else {

      toast(
        "Some products from this order are no longer available."
      );

    }


  } catch (error) {

    toast(
      error.message ||
      "Unable to reorder."
    );

  }

}


/* =========================================================
   ORDER TRACKING FROM LOCAL HISTORY
   ========================================================= */

function rememberOrderFromCheckout(
  orderId,
  total
) {

  saveLocalOrder({
    orderId,
    total,
    createdAt:
      new Date().toISOString()
  });

}


/*
  checkout.js can call this function after
  a successful order.
*/
window.rememberOrderFromCheckout =
  rememberOrderFromCheckout;


/* =========================================================
   REVIEWS / RATINGS — LOCAL CUSTOMER REVIEWS
   ========================================================= */

function getReviews() {

  return JSON.parse(
    localStorage.getItem(
      REVIEWS_KEY
    ) || "[]"
  );

}


function saveReview(review) {

  const reviews =
    getReviews();

  reviews.push(review);

  localStorage.setItem(
    REVIEWS_KEY,
    JSON.stringify(reviews)
  );

}


function getProductReviews(productId) {

  return getReviews().filter(
    review =>
      Number(review.productId) ===
      Number(productId)
  );

}


/* =========================================================
   THEME SUPPORT
   ========================================================= */

function loadTheme() {

  const theme =
    localStorage.getItem(
      THEME_KEY
    );


  if (theme === "dark") {

    document.body.classList.add("dark");

  }

}


function toggleTheme() {

  const dark =
    document.body.classList.toggle(
      "dark"
    );


  localStorage.setItem(
    THEME_KEY,
    dark ? "dark" : "light"
  );

}


window.toggleZevoriaTheme =
  toggleTheme;


/* =========================================================
   AUTO SAVE CURRENT CART
   ========================================================= */

window.addEventListener(
  "beforeunload",
  saveCart
);


/* =========================================================
   INITIALIZE
   ========================================================= */

function initialize() {

  loadTheme();

  renderProducts();

  renderCart();

  renderWishlist();

  updateCounts();

  updateAccountUI();

  refreshIcons();

}


initialize();


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;

window.quickView = quickView;

window.toggleWishlist =
  toggleWishlist;

window.trackOrder =
  trackOrder;

window.reorder =
  reorder;

window.openScentFinder =
  openScentFinder;

window.closeModal =
  closeModal;

window.renderOrderHistory =
  renderOrderHistory;

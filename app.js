const API_BASE = "https://zevoria-backend.onrender.com";


/* =========================================================
   ZEVORIA PRODUCTS
========================================================= */

const products = [
  {
    name: "No. 01 Noir",
    cat: "men",
    type: "Eau de Parfum",
    price: 1499,
    note: "Amber • Oud • Vanilla",
    backendId: 1,
    description:
      "A deep and sophisticated fragrance built around warm amber, rich oud and smooth vanilla.",
    styles: ["dark", "oud", "sweet", "woody"]
  },
  {
    name: "No. 02 Santal",
    cat: "unisex",
    type: "Eau de Parfum",
    price: 1699,
    note: "Sandalwood • Musk • Cedar",
    backendId: 2,
    description:
      "A refined woody fragrance combining creamy sandalwood, clean musk and dry cedar.",
    styles: ["woody", "fresh"]
  },
  {
    name: "No. 03 Bloom",
    cat: "women",
    type: "Eau de Parfum",
    price: 1399,
    note: "Rose • Peony • Vanilla",
    backendId: 3,
    description:
      "A soft floral composition with elegant rose, delicate peony and creamy vanilla.",
    styles: ["floral", "sweet"]
  },
  {
    name: "No. 04 Oud",
    cat: "unisex",
    type: "Attar",
    price: 899,
    note: "Oud • Saffron • Amber",
    backendId: 4,
    description:
      "A concentrated attar with rich oud, warm saffron and smooth amber.",
    styles: ["oud", "dark", "woody"]
  },
  {
    name: "No. 05 Azure",
    cat: "men",
    type: "Eau de Parfum",
    price: 1599,
    note: "Bergamot • Marine • Musk",
    backendId: 5,
    description:
      "A fresh modern fragrance combining bright bergamot, marine notes and clean musk.",
    styles: ["fresh"]
  },
  {
    name: "No. 06 Velvet",
    cat: "women",
    type: "Eau de Parfum",
    price: 1499,
    note: "Iris • Tonka • Amber",
    backendId: 6,
    description:
      "A smooth elegant fragrance with powdery iris, creamy tonka and warm amber.",
    styles: ["sweet", "floral", "dark"]
  }
];


/* =========================================================
   LOCAL STORAGE
========================================================= */

let cart = JSON.parse(
  localStorage.getItem("zevoriaCart") || "[]"
);

let wishlist = JSON.parse(
  localStorage.getItem("zevoriaWishlist") || "[]"
);


/* =========================================================
   HELPERS
========================================================= */

const $ = s => document.querySelector(s);

const $$ = s => document.querySelectorAll(s);

const money = n =>
  "₹" + Number(n).toLocaleString("en-IN");


function getProduct(i) {
  return products[i];
}


function saveWishlist() {

  localStorage.setItem(
    "zevoriaWishlist",
    JSON.stringify(wishlist)
  );

}


/* =========================================================
   LUCIDE ICONS
========================================================= */

function refreshIcons() {

  if (window.lucide) {
    lucide.createIcons();
  }

}


/* =========================================================
   PRODUCTS
========================================================= */

function renderProducts(list = products) {

  const el = $("#products");

  if (!el) return;

  if (!list.length) {

    el.innerHTML = `
      <div class="empty-products">
        <p class="muted">
          No fragrances found.
        </p>
      </div>
    `;

    return;
  }


  el.innerHTML = list.map(p => {

    const index = products.indexOf(p);

    const liked =
      wishlist.includes(index);


    return `
      <article class="product">

        <div
          class="product-img"
          onclick="quickView(${index})"
        >

          <button
            class="heart ${liked ? "active" : ""}"
            onclick="event.stopPropagation(); toggleWishlist(${index})"
            aria-label="Wishlist"
          >
            <i
              data-lucide="heart"
              ${liked ? 'fill="currentColor"' : ""}
            ></i>
          </button>

          <div class="mini-bottle">
            <div class="mini-cap"></div>
          </div>

          <button
            class="quick-view-btn"
            onclick="event.stopPropagation(); quickView(${index})"
          >
            <i data-lucide="eye"></i>
            Quick view
          </button>

        </div>

        <div class="product-info">

          <div class="meta">
            ${p.type} · ${p.cat}
          </div>

          <h3>${p.name}</h3>

          <div class="meta">
            ${p.note}
          </div>

          <div class="price">
            ${money(p.price)}
          </div>

          <button
            class="add"
            onclick="add(${index})"
          >
            Add to bag
          </button>

        </div>

      </article>
    `;

  }).join("");


  refreshIcons();
}


/* =========================================================
   CART
========================================================= */

function add(i) {

  const p = products[i];

  const existing = cart.find(
    x => x.i === i
  );


  if (existing) {

    existing.q++;

  } else {

    cart.push({
      i,
      q: 1
    });

  }


  save();

  toast(
    p.name + " added to bag"
  );

  openCart();
}


function save() {

  localStorage.setItem(
    "zevoriaCart",
    JSON.stringify(cart)
  );

  renderCart();

  $("#cartCount").textContent =
    cart.reduce(
      (total, item) => total + item.q,
      0
    );

}


function renderCart() {

  const el = $("#cartItems");

  if (!el) return;


  if (!cart.length) {

    el.innerHTML = `
      <div class="empty-cart">
        <p class="muted">
          Your bag is empty.
        </p>

        <p class="muted">
          Explore the collection and add a fragrance.
        </p>
      </div>
    `;

    $("#subtotal").textContent = "₹0";

    return;
  }


  el.innerHTML = cart.map(item => {

    const p = products[item.i];

    return `
      <div class="cart-row">

        <div class="cart-thumb"></div>

        <div style="flex:1">

          <h4>${p.name}</h4>

          <small>${money(p.price)}</small>

          <div class="qty">

            <button
              onclick="change(${item.i},-1)"
              aria-label="Decrease"
            >
              −
            </button>

            <span>${item.q}</span>

            <button
              onclick="change(${item.i},1)"
              aria-label="Increase"
            >
              +
            </button>

            <button
              class="cart-remove"
              onclick="removeItem(${item.i})"
            >
              Remove
            </button>

          </div>

        </div>

      </div>
    `;

  }).join("");


  const subtotal =
    cart.reduce(
      (total, item) =>
        total +
        products[item.i].price * item.q,
      0
    );


  $("#subtotal").textContent =
    money(subtotal);
}


function change(i, amount) {

  const item = cart.find(
    x => x.i === i
  );

  if (!item) return;


  item.q += amount;


  if (item.q <= 0) {

    cart =
      cart.filter(
        x => x.i !== i
      );

  }


  save();
}


function removeItem(i) {

  cart =
    cart.filter(
      x => x.i !== i
    );

  save();

  toast("Item removed from bag");
}


/* =========================================================
   WISHLIST
========================================================= */

function toggleWishlist(i) {

  const p = products[i];

  if (wishlist.includes(i)) {

    wishlist =
      wishlist.filter(
        x => x !== i
      );

    toast(
      p.name + " removed from wishlist"
    );

  } else {

    wishlist.push(i);

    toast(
      p.name + " added to wishlist"
    );

  }


  saveWishlist();

  renderProducts(
    getCurrentProductList()
  );

}


function getCurrentProductList() {

  const active =
    document.querySelector(
      ".filter.active"
    );

  if (!active || active.dataset.filter === "all") {
    return products;
  }

  return products.filter(
    p =>
      p.cat === active.dataset.filter
  );
}


function openWishlist() {

  renderWishlist();

  modal("#wishlistModal");
}


function renderWishlist() {

  const el =
    $("#wishlistItems");

  if (!el) return;


  if (!wishlist.length) {

    el.innerHTML = `
      <p class="muted">
        Your wishlist is empty.
      </p>

      <p class="muted">
        Tap the heart on a fragrance to save it here.
      </p>
    `;

    return;
  }


  el.innerHTML =
    wishlist.map(i => {

      const p = products[i];

      return `
        <div class="wishlist-card">

          <div class="wishlist-card-thumb"></div>

          <div class="wishlist-card-info">

            <strong>${p.name}</strong>

            <div class="meta">
              ${p.note}
            </div>

            <div class="price">
              ${money(p.price)}
            </div>

          </div>

          <div class="wishlist-actions">

            <button onclick="add(${i})">
              Add
            </button>

            <button onclick="toggleWishlist(${i})">
              Remove
            </button>

          </div>

        </div>
      `;

    }).join("");

}


/* =========================================================
   QUICK VIEW
========================================================= */

function quickView(i) {

  const p = products[i];

  $("#quickViewContent").innerHTML = `

    <div class="quick-view">

      <div class="quick-view-image">

        <div class="quick-view-bottle"></div>

      </div>

      <div class="quick-view-info">

        <div class="meta">
          ${p.type} · ${p.cat}
        </div>

        <h3>
          ${p.name}
        </h3>

        <div class="meta">
          ${p.note}
        </div>

        <p class="quick-view-note">
          ${p.description}
        </p>

        <div class="quick-view-price">
          ${money(p.price)}
        </div>

        <button
          class="btn btn-dark full"
          onclick="add(${i}); closeAll();"
        >
          Add to bag
          <i data-lucide="shopping-bag"></i>
        </button>

      </div>

    </div>
  `;

  modal("#quickViewModal");

  refreshIcons();
}


/* =========================================================
   UI
========================================================= */

function toast(message) {

  const element =
    $("#toast");

  element.textContent =
    message;

  element.classList.add("show");


  setTimeout(
    () =>
      element.classList.remove("show"),
    1800
  );
}


function openCart() {

  $("#overlay").classList.add("show");

  $("#cartDrawer").classList.add("open");

}


function closeAll() {

  $("#overlay").classList.remove("show");

  $("#cartDrawer").classList.remove("open");

  $$(".modal").forEach(
    element =>
      element.classList.remove("show")
  );

}


function modal(id) {

  $("#overlay").classList.add("show");

  $(id).classList.add("show");

}


$("#cartBtn").onclick =
  openCart;


$("#searchBtn").onclick =
  () => modal("#searchModal");


$("#accountBtn").onclick =
  () => {

    updateAccountUI();

    modal("#accountModal");

  };


$("#overlay").onclick =
  closeAll;


$$("[data-close]").forEach(
  element =>
    element.onclick = closeAll
);


$("#menuBtn").onclick =
  () =>
    $("#nav").classList.toggle("open");


/* =========================================================
   FILTERS
========================================================= */

$$(".filter").forEach(button => {

  button.onclick = () => {

    $$(".filter").forEach(
      item =>
        item.classList.remove("active")
    );


    button.classList.add("active");


    const filter =
      button.dataset.filter;


    renderProducts(
      filter === "all"
        ? products
        : products.filter(
            p =>
              p.cat === filter
          )
    );

  };

});


/* =========================================================
   ATTARS
========================================================= */

$("#attarBtn").onclick = () => {

  $$(".filter").forEach(
    button =>
      button.classList.remove("active")
  );


  const allButton =
    document.querySelector(
      '[data-filter="all"]'
    );


  if (allButton) {
    allButton.classList.add("active");
  }


  renderProducts(
    products.filter(
      p =>
        p.type === "Attar"
    )
  );


  $("#shop").scrollIntoView({
    behavior:"smooth"
  });

};


/* =========================================================
   SEARCH
========================================================= */

$("#searchInput").oninput =
  event => {

    const query =
      event.target.value
        .trim()
        .toLowerCase();


    if (!query) {

      $("#searchResults").innerHTML = `
        <p class="muted">
          Search by perfume name, note or fragrance type.
        </p>
      `;

      return;
    }


    const results =
      products.filter(
        p =>
          (
            p.name +
            " " +
            p.note +
            " " +
            p.type +
            " " +
            p.cat +
            " " +
            p.description
          )
            .toLowerCase()
            .includes(query)
      );


    if (!results.length) {

      $("#searchResults").innerHTML =
        "<p class='muted'>No fragrance found.</p>";

      return;
    }


    $("#searchResults").innerHTML =
      results.map(p => {

        const index =
          products.indexOf(p);

        return `
          <div
            class="search-result"
            onclick="quickView(${index})"
          >

            <div>
              <strong>${p.name}</strong>

              <br>

              <small>
                ${p.note} · ${p.type}
              </small>
            </div>

            <strong>
              ${money(p.price)}
            </strong>

          </div>
        `;

      }).join("");

  };


/* =========================================================
   NEWSLETTER
========================================================= */

$("#newsletter").onsubmit =
  event => {

    event.preventDefault();

    const email =
      event.target.querySelector(
        "input"
      ).value.trim();


    if (!email) return;


    /*
      Saved locally for now.
      Later this can be connected
      to the backend newsletter table.
    */

    const subscribers =
      JSON.parse(
        localStorage.getItem(
          "zevoriaNewsletter"
        ) || "[]"
      );


    if (!subscribers.includes(email)) {
      subscribers.push(email);
    }


    localStorage.setItem(
      "zevoriaNewsletter",
      JSON.stringify(subscribers)
    );


    toast(
      "Thanks — you're on the list."
    );


    event.target.reset();

  };


/* =========================================================
   ACCOUNT
========================================================= */

function updateAccountUI() {

  const user =
    JSON.parse(
      localStorage.getItem(
        "zevoriaUser"
      ) || "null"
    );


  const loggedOut =
    $("#loggedOutAccount");

  const loggedIn =
    $("#loggedInAccount");

  const title =
    $("#accountTitle");


  if (user) {

    loggedOut.style.display =
      "none";

    loggedIn.style.display =
      "block";

    title.textContent =
      "Welcome back, " +
      user.name;


    $("#accountName").textContent =
      user.name || "";


    $("#accountEmail").textContent =
      user.email || "";


    $("#accountPhone").textContent =
      user.phone || "";


  } else {

    loggedOut.style.display =
      "block";

    loggedIn.style.display =
      "none";

    title.textContent =
      "Welcome to ZEVORIA";

  }

}


/* =========================================================
   SIGNUP / LOGIN SWITCH
========================================================= */

$("#showSignupBtn").onclick =
  () => {

    $("#loginForm").style.display =
      "none";

    $("#showSignupBtn").style.display =
      "none";

    $("#signupForm").style.display =
      "block";

  };


$("#showLoginBtn").onclick =
  () => {

    $("#signupForm").style.display =
      "none";

    $("#loginForm").style.display =
      "block";

    $("#showSignupBtn").style.display =
      "block";

  };


/* =========================================================
   SIGNUP
========================================================= */

$("#signupForm").onsubmit =
  async event => {

    event.preventDefault();


    const button =
      $("#signupBtn");

    const oldText =
      button.textContent;


    button.disabled = true;

    button.textContent =
      "Creating account...";


    const name =
      $("#signupName")
        .value
        .trim();


    const email =
      $("#signupEmail")
        .value
        .trim();


    const phone =
      $("#signupPhone")
        .value
        .trim();


    const password =
      $("#signupPassword")
        .value;


    try {

      const response =
        await fetch(
          `${API_BASE}/api/auth/signup`,
          {
            method:"POST",

            headers:{
              "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
              name,
              email,
              phone,
              password
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
          "Could not create account"
        );

      }


      localStorage.setItem(
        "zevoriaUser",
        JSON.stringify(
          data.user
        )
      );


      toast(
        "Account created successfully"
      );


      event.target.reset();

      updateAccountUI();


    } catch (error) {

      toast(error.message);

      alert(
        "Account could not be created.\n\n" +
        error.message
      );


    } finally {

      button.disabled =
        false;

      button.textContent =
        oldText;

    }

  };


/* =========================================================
   LOGIN
========================================================= */

$("#loginForm").onsubmit =
  async event => {

    event.preventDefault();


    const button =
      $("#loginBtn");

    const oldText =
      button.textContent;


    button.disabled = true;

    button.textContent =
      "Signing in...";


    const email =
      $("#loginEmail")
        .value
        .trim();


    const password =
      $("#loginPassword")
        .value;


    try {

      const response =
        await fetch(
          `${API_BASE}/api/auth/login`,
          {
            method:"POST",

            headers:{
              "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
              email,
              password
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
          "Invalid email or password"
        );

      }


      localStorage.setItem(
        "zevoriaUser",
        JSON.stringify(
          data.user
        )
      );


      toast(
        "Signed in successfully"
      );


      event.target.reset();

      updateAccountUI();


    } catch (error) {

      toast(error.message);

      alert(
        "Sign in failed.\n\n" +
        error.message
      );


    } finally {

      button.disabled =
        false;

      button.textContent =
        oldText;

    }

  };


/* =========================================================
   LOGOUT
========================================================= */

$("#logoutBtn").onclick =
  () => {

    localStorage.removeItem(
      "zevoriaUser"
    );

    updateAccountUI();

    toast(
      "You have been signed out"
    );

  };


/* =========================================================
   ACCOUNT WISHLIST
========================================================= */

$("#wishlistAccountBtn").onclick =
  () => {

    closeAll();

    openWishlist();

  };


/* =========================================================
   SCENT FINDER
========================================================= */

function openScentFinder() {

  $("#scentStep").style.display =
    "block";

  $("#scentResults").style.display =
    "none";

  modal("#scentModal");

}


$("#scentFinderBtn").onclick =
  openScentFinder;


$("#storyScentBtn").onclick =
  openScentFinder;


$$(".scent-options button").forEach(
  button => {

    button.onclick = () => {

      const style =
        button.dataset.value;

      showScentResults(style);

    };

  }
);


function showScentResults(style) {

  const matches =
    products
      .filter(
        product =>
          product.styles.includes(style)
      )
      .slice(0,3);


  $("#scentStep").style.display =
    "none";

  $("#scentResults").style.display =
    "block";


  if (!matches.length) {

    $("#scentRecommendations").innerHTML = `
      <p class="muted">
        We couldn't find a direct match.
        Explore the complete collection.
      </p>
    `;

    return;
  }


  $("#scentRecommendations").innerHTML =
    matches.map(product => {

      const index =
        products.indexOf(product);

      return `
        <div class="scent-result-card">

          <h4>${product.name}</h4>

          <div class="meta">
            ${product.type} · ${product.cat}
          </div>

          <p>
            ${product.note}
          </p>

          <strong>
            ${money(product.price)}
          </strong>

          <div class="scent-result-actions">

            <button
              onclick="quickView(${index})"
            >
              Quick view
            </button>

            <button
              onclick="add(${index})"
            >
              Add to bag
            </button>

          </div>

        </div>
      `;

    }).join("");

}


$("#restartScentBtn").onclick =
  () => {

    $("#scentResults").style.display =
      "none";

    $("#scentStep").style.display =
      "block";

  };


/* =========================================================
   CHECKOUT
========================================================= */

$("#checkoutBtn").onclick =
  () => {

    if (!cart.length) {

      toast(
        "Your bag is empty"
      );

      return;

    }


    window.location.href =
      "checkout.html";

  };


/* =========================================================
   START APP
========================================================= */

renderProducts();

save();

updateAccountUI();

refreshIcons();

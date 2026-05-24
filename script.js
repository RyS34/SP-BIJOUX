import { db } from "./firebase.js";
import {
    collection,
    addDoc,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =========================
   ESTADO INICIAL Y DATOS
========================= */
let cart = [];
try {
    cart = JSON.parse(localStorage.getItem("cart")) || [];
} catch (e) {
    cart = [];
}

let allProducts = [];

let filters = {
    query: "",
    category: "all",
    minPrice: 0,
    maxPrice: Infinity,
    sort: "default"
};


/* =========================
   ELEMENTOS DEL DOM
========================= */
const overlay = document.getElementById("overlay");
const sidebarMenu = document.getElementById("sidebar");
const cartSidebar = document.getElementById("cart-sidebar");
const contactSidebar = document.getElementById("contact-sidebar");

const menuBtn = document.getElementById("menu-btn");
const cartIconBtn = document.getElementById("cart-icon-btn");
const navContactLink = document.getElementById("nav-contact-link");
const sidebarContactLink = document.getElementById("sidebar-contact-link");

const closeMenuBtn = document.getElementById("close-btn");
const closeCartBtn = document.getElementById("close-cart");
const closeContactBtn = document.getElementById("close-contact");

const cartItemsContainer = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartCount = document.getElementById("cart-count");
const searchInput = document.getElementById("search-input");
let searchTimeout;
const productContainer = document.getElementById("product-container");
const imageModal = document.getElementById("image-modal");
const modalImg = document.getElementById("modal-img");
const closeModal = document.querySelector(".image-modal .close-modal");

function lockScroll() {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
}

function unlockScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
}

if (imageModal && modalImg && closeModal) {

    closeModal.addEventListener("click", () => {
        imageModal.classList.remove("active");
        unlockScroll();
        resetZoom();
    });

    imageModal.addEventListener("click", (e) => {
        if (e.target === imageModal) {
            imageModal.classList.remove("active");
            unlockScroll();
            resetZoom();
        }
    });
}
let zoomLevel = 1;

function resetZoom() {
    zoomLevel = 1;
    modalImg.style.transform = "scale(1)";
}

if (modalImg) {

    modalImg.style.transformOrigin = "center";
    modalImg.style.transition = "transform 0.2s ease";

    modalImg.addEventListener("wheel", (e) => {
        e.preventDefault();

        if (e.deltaY < 0) {
            zoomLevel += 0.1;
        } else {
            zoomLevel -= 0.1;
        }

        zoomLevel = Math.min(Math.max(zoomLevel, 1), 3);

        modalImg.style.transform = `scale(${zoomLevel})`;
    });
}


const checkoutBtn = document.getElementById("checkout-btn");

/* =========================
   OVERLAY CONTROL
========================= */
function setOverlay(state) {
    overlay?.classList.toggle("active", state);
}

/* =========================
   CIERRE UNIFICADO
========================= */
function closeAllPanels() {

    // ELIMINA EL FOCO DEL ELEMENTO ACTIVO
    if (document.activeElement) {
        document.activeElement.blur();
    }

    [sidebarMenu, cartSidebar, contactSidebar].forEach(el => {

        el?.classList.remove("active");

        el?.setAttribute("aria-hidden", "true");
    });

    setOverlay(false);

    document.body.style.overflow = "";

    menuBtn?.setAttribute("aria-expanded", "false");
}

function closeUI() {
    closeAllPanels();
}

/* =========================
   ABRIR MENÚ
========================= */
menuBtn?.addEventListener("click", () => {

    closeAllPanels();

    sidebarMenu?.classList.add("active");

    sidebarMenu?.setAttribute("aria-hidden", "false");

    setOverlay(true);

    document.body.style.overflow = "hidden";

    menuBtn?.setAttribute("aria-expanded", "true");
});

/* =========================
   ABRIR CARRITO
========================= */
cartIconBtn?.addEventListener("click", () => {
    closeAllPanels();

    cartSidebar?.classList.add("active");
    cartSidebar?.setAttribute("aria-hidden", "false");
    setOverlay(true);
    document.body.style.overflow = "hidden";

    renderCart();
});

/* =========================
   ABRIR CONTACTO
========================= */
const handleContactClick = (e) => {
    e.preventDefault();

    closeAllPanels();

    contactSidebar?.classList.add("active");
    contactSidebar?.setAttribute("aria-hidden", "false");
    setOverlay(true);
    document.body.style.overflow = "hidden";
};

navContactLink?.addEventListener("click", handleContactClick);
sidebarContactLink?.addEventListener("click", handleContactClick);

/* =========================
   CIERRE (X + OVERLAY)
========================= */
closeMenuBtn?.addEventListener("click", closeUI);
closeCartBtn?.addEventListener("click", closeUI);
closeContactBtn?.addEventListener("click", closeUI);
overlay?.addEventListener("click", closeUI);

/* =========================
   LINKS MENÚ MOBILE
========================= */

document.querySelectorAll(".mobile-link").forEach(link => {

    link.addEventListener("click", () => {

        closeAllPanels();
    });
});

/* =========================
   CARRITO
========================= */
function updateCartUI() {
    if (cartCount) cartCount.textContent = cart.length;
}

function addToCart(producto) {
    const exists = cart.find(p => p.nombre === producto.nombre);
    if (exists) {
        alert("Este producto ya está en el carrito 🛒");
        return;
    }

    cart.push(producto);
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartUI();
    alert("Producto agregado 🛒");
}

function renderCart() {
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        total += Number(item.precio) || 0;

        cartItemsContainer.innerHTML += `
            <div class="cart-item">
                <div class="item-info">
                    <p>${item.nombre}</p>
                    <small>S/ ${Number(item.precio).toFixed(2)}</small>
                </div>
                <button onclick="removeFromCart(${index})">🗑</button>
            </div>
        `;
    });

    if (cartTotal) cartTotal.textContent = total.toFixed(2);
}

window.removeFromCart = function (index) {
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartUI();
    renderCart();
};

/* =========================
   PRODUCTOS
========================= */
async function cargarProductos() {
    try {
        const snapshot = await getDocs(collection(db, "productos"));
        allProducts = [];

        if (!productContainer) return;


        snapshot.forEach((doc) => {
            const producto = doc.data();
            // NORMALIZAR categoría (CLAVE)
            producto.categoria = (producto.categoria || "").toLowerCase().trim();
            console.log("CATEGORÍA:", producto.categoria);

            // 1. guardar primero
            allProducts.push(producto);

            // 2. crear elemento
            const card = document.createElement("div");
            card.classList.add("product-card");

            // 3. estructura visual
            card.innerHTML = `
            <div class="product-img-wrapper">
            <img src="${producto.imagen}" alt="${producto.nombre}">
            </div>

            <div class="product-details">
             <h3>${producto.nombre}</h3>
             <p class="price">S/ ${Number(producto.precio).toFixed(2)}</p>

            <button class="add-to-cart-btn">
            🛒 Agregar
        </button>
    </div>
`;

            // 4. eventos separados (más limpio)
            const btn = card.querySelector(".add-to-cart-btn");
            btn.addEventListener("click", () => addToCart(producto));


        });

    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

/* =========================
   BUSCADOR
========================= */
searchInput?.addEventListener("input", () => {

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {

        filters.query = searchInput.value.toLowerCase().trim();

        applyFilters();

    }, 300);

});

function highlightText(text, query) {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, "gi");

    return text.replace(regex, `<mark>$1</mark>`);
}

function applyFilters() {

    let results = [...allProducts];

    // 🔎 BUSCADOR
    if (filters.query) {
        results = results.filter(p =>
            (p.nombre || "").toLowerCase()
                .includes(filters.query)
        );
    }

    // 🏷️ CATEGORÍA
    if (filters.category !== "all") {
        results = results.filter(p => {
            const categoria = (p.categoria || "")
                .toLowerCase()
                .trim();

            const filtro = filters.category.toLowerCase().trim();

            return categoria.includes(filtro);
        });
    }

    // 💰 PRECIO MÍNIMO
    results = results.filter(p =>
        Number(p.precio || 0) >= filters.minPrice
    );

    // 💰 PRECIO MÁXIMO
    results = results.filter(p =>
        Number(p.precio || 0) <= filters.maxPrice
    );

    // 🔃 ORDEN
    if (filters.sort === "low") {
        results.sort((a, b) => a.precio - b.precio);
    }

    if (filters.sort === "high") {
        results.sort((a, b) => b.precio - a.precio);
    }

    renderProducts(results);
    updateURL();
}

/* =========================
CHECKOUT
========================= */
async function checkout() {
    if (!cart.length) {
        alert("Tu carrito está vacío");
        return;
    }

    try {
        const total = cart.reduce((sum, item) =>
            sum + (Number(item.precio) || 0), 0
        );

        const pedido = {
            productos: cart,
            total,
            estado: "Pendiente",
            fecha: serverTimestamp()
        };

        await addDoc(collection(db, "pedidos"), pedido);

        alert("Compra realizada 🎉");

        cart = [];
        localStorage.setItem("cart", JSON.stringify(cart));
        updateCartUI();
        closeAllPanels();

    } catch (error) {
        console.error(error);
        alert("Error al procesar pedido");
    }
}

/* =========================
SearchResults
========================= */
function renderProducts(list) {

    if (!productContainer) return;

    productContainer.innerHTML = "";

    if (list.length === 0) {
        productContainer.innerHTML = `
            <p style="padding:20px;">No se encontraron productos 🔎</p>
        `;
        return;
    }

    list.forEach(producto => {

        const card = document.createElement("div");
        card.classList.add("product-card");

        const img = document.createElement("img");
        img.src = producto.imagen;
        img.alt = producto.nombre;

        img.addEventListener("click", () => {
            modalImg.src = producto.imagen;
            imageModal.classList.add("active");
            lockScroll();
        });

        const wrapper = document.createElement("div");
        wrapper.classList.add("product-img-wrapper");
        wrapper.appendChild(img);

        const details = document.createElement("div");
        details.classList.add("product-details");

        details.innerHTML = `
            <h3>${producto.nombre}</h3>
            <p class="price">S/ ${Number(producto.precio).toFixed(2)}</p>
            <button class="add-to-cart-btn">🛒 Agregar</button>
        `;

        card.appendChild(wrapper);
        card.appendChild(details);

        card.querySelector(".add-to-cart-btn")
            .addEventListener("click", () => addToCart(producto));

        productContainer.appendChild(card);
    });
}

checkoutBtn?.addEventListener("click", checkout);


/* =========================
FILTROS (EVENTOS UI)
========================= */
const categoryFilter = document.getElementById("categoryFilter");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
const sortFilter = document.getElementById("sortFilter");

categoryFilter?.addEventListener("change", (e) => {
    filters.category = (e.target.value || "all").toLowerCase().trim();
    applyFilters();
});

minPriceInput?.addEventListener("input", (e) => {
    filters.minPrice = Number(e.target.value) || 0;
    applyFilters();
});

maxPriceInput?.addEventListener("input", (e) => {
    filters.maxPrice = Number(e.target.value) || Infinity;
    applyFilters();
});

sortFilter?.addEventListener("change", (e) => {
    filters.sort = e.target.value;
    applyFilters();
});


/* =========================
FILTROS DESDE URL
========================= */
function loadFiltersFromURL() {

    const params = new URLSearchParams(window.location.search);

    filters.query = params.get("search") || "";
    // SOLO aplicar si NO viene de página
    if (!window.categoryPage) {
        filters.category = (params.get("category") || "all").toLowerCase().trim();
    }
    filters.minPrice = Number(params.get("min")) || 0;
    filters.maxPrice = Number(params.get("max")) || Infinity;
    filters.sort = params.get("sort") || "default";

    // sincronizar inputs HTML
    if (searchInput) searchInput.value = filters.query;
    if (categoryFilter) categoryFilter.value = filters.category;
    if (minPriceInput) minPriceInput.value = params.get("min") || "";
    if (maxPriceInput) maxPriceInput.value = params.get("max") || "";
    if (sortFilter) sortFilter.value = filters.sort;
}

/* =========================
ACTUALIZAR URL CON FILTROS
========================= */
function updateURL() {

    const params = new URLSearchParams();

    if (filters.query) params.set("search", filters.query);
    if (filters.category !== "all") params.set("category", filters.category);
    if (filters.minPrice) params.set("min", filters.minPrice);
    if (filters.maxPrice !== Infinity) params.set("max", filters.maxPrice);
    if (filters.sort !== "default") params.set("sort", filters.sort);

    const newURL = `${window.location.pathname}?${params.toString()}`;

    window.history.replaceState({}, "", newURL);
}

/* =========================
INICIALIZACIÓN
========================= */
async function initApp() {

    // 1. cargar datos
    await cargarProductos();

    // 2. primero URL (pero NO pisar página)
    loadFiltersFromURL();

    // 3. SI hay categoryPage, tiene prioridad absoluta
    if (window.categoryPage) {
        filters.category = window.categoryPage;
    }

    // 4. aplicar filtros YA con todo definido
    applyFilters();

    updateCartUI();
}

/* ========================================
   HERO VIDEO END
======================================== */

const heroVideo = document.getElementById("hero-video");
const heroContent = document.querySelector(".hero-content");

if (heroVideo && heroContent) {

    heroVideo.addEventListener("ended", () => {

        /* ocultar video suavemente */
        heroVideo.style.opacity = "0";

        /* mostrar contenido */
        setTimeout(() => {

            heroContent.classList.add("show");

        }, 400);

    });

}
/* =========================
INICIAR APLICACIÓN
========================= */    
initApp();
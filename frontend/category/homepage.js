/**
 * homepage.js
 * Handles two things on index.html:
 *   1. Cart badge — reads dreak_cart from localStorage and
 *      keeps the .cart-count span in sync on every page load.
 *   2. Featured products section — fetches featured categories,
 *      builds dynamic filter tabs, then loads products per tab.
 */

import { BASE_URL } from "../config.js";
import { getAllCategories } from "./categoryService.js";
import { getProducts, getPrimaryImage, variantFinalPrice, formatINR } from "./productService.js";

/* ═══════════════════════════════════════════════════════
   1.  CART BADGE SYNC
   Reads localStorage on every page load so the count
   always reflects what's actually in the cart.
═══════════════════════════════════════════════════════ */
function syncCartBadge() {
    try {
        const cart = JSON.parse(localStorage.getItem("dreak_cart")) || [];
        const total = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
        // index.html uses .cart-count inside .cart-icon
        document.querySelectorAll(".cart-count").forEach(el => {
            el.textContent = total;
        });
    } catch {
        // localStorage unavailable — leave badge as-is
    }
}

/* ═══════════════════════════════════════════════════════
   2.  FEATURED PRODUCTS
═══════════════════════════════════════════════════════ */

const PRODUCTS_LIMIT = 8;   // max cards shown per tab
let activeSlug = "";  // "" means "All"
let isFetching = false;

/** Escape HTML to prevent XSS */
function esc(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Build a single product card matching the site's design language */
function buildProductCard(product) {
    const img = getPrimaryImage(product.images);
    const variant = (product.variants || [])[0];
    const fp = variant ? variantFinalPrice(variant) : null;
    const discount = variant?.discountPercentage || 0;
    const hasDisc = discount > 0;

    const imgHtml = img
        ? `<img src="${BASE_URL}${esc(img)}" alt="${esc(product.name)}" loading="lazy" class="prod-img" />`
        : `<div class="prod-img-ph"><i class="fas fa-couch"></i></div>`;

    const priceHtml = fp != null
        ? hasDisc
            ? `<span class="fp-price">${formatINR(fp)}</span>
               <span class="fp-original">${formatINR(variant.price)}</span>
               <span class="fp-badge">${discount}% off</span>`
            : `<span class="fp-price">${formatINR(fp)}</span>`
        : "";

    return `
        <a class="fp-card" href="/product?slug=${encodeURIComponent(product.slug)}"
           aria-label="${esc(product.name)}">
            <div class="fp-img-wrap">${imgHtml}</div>
            <div class="fp-info">
                <p class="fp-name">${esc(product.name)}</p>
                <div class="fp-price-row">${priceHtml}</div>
            </div>
        </a>`;
}

/** Skeleton placeholder cards while loading */
function skeletonCards(n = PRODUCTS_LIMIT) {
    return Array(n).fill(`
        <div class="fp-card fp-skel">
            <div class="fp-img-wrap fp-skel-img"></div>
            <div class="fp-skel-body">
                <div class="fp-skel-line"></div>
                <div class="fp-skel-line fp-skel-line--short"></div>
            </div>
        </div>`).join("");
}

/** Fetch + render products for the active tab */
async function loadProducts(categorySlug) {
    if (isFetching) return;
    isFetching = true;

    const grid = document.getElementById("productsGrid");
    if (!grid) { isFetching = false; return; }

    grid.innerHTML = skeletonCards();

    try {
        const opts = { limit: PRODUCTS_LIMIT, sort: "newest" };
        if (categorySlug) opts.category = categorySlug;

        const data = await getProducts(opts);
        const products = data.products || [];

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="fp-empty">
                    <i class="fas fa-search"></i>
                    <p>No products found in this category yet.</p>
                </div>`;
        } else {
            grid.innerHTML = products.map(buildProductCard).join("");
        }
    } catch (err) {
        console.warn("[Dreak Trading] Featured products failed:", err);
        grid.innerHTML = `
            <div class="fp-empty">
                <i class="fas fa-exclamation-circle"></i>
                <p>Could not load products. Please refresh.</p>
            </div>`;
    } finally {
        isFetching = false;
    }
}

/** Build dynamic filter tabs from featured categories */
async function buildFeaturedTabs() {
    const tabsContainer = document.querySelector(".filter-tabs");
    if (!tabsContainer) return;

    // Show a loading state in the tabs row
    tabsContainer.innerHTML = `<div class="tab-loading">Loading categories…</div>`;

    let categories = [];
    let subLevel = []
    try {
        const data = await getAllCategories();
        categories = data.categories || [];

        subLevel = categories.filter((c) => c.parent)
        if (!subLevel) return

    } catch (err) {
        console.warn("[Dreak Trading] Featured categories failed:", err);
        // Fall back: render static "All" tab and load all products
        categories = [];
    }

    // Build tabs: "All" first, then one per featured category
    const allTab = document.createElement("button");
    allTab.className = "tab active";
    allTab.textContent = "All";
    allTab.dataset.slug = "";

    tabsContainer.innerHTML = "";
    tabsContainer.appendChild(allTab);

    subLevel.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "tab";
        btn.textContent = cat.name;
        btn.dataset.slug = cat.slug;
        tabsContainer.appendChild(btn);
    });

    // Tab click handler
    tabsContainer.addEventListener("click", e => {
        const btn = e.target.closest(".tab");
        if (!btn || btn.classList.contains("active")) return;

        tabsContainer.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        activeSlug = btn.dataset.slug || "";
        loadProducts(activeSlug);
    });

    // Initial load with "All" tab active
    loadProducts("");
}

/* ─── Inject CSS needed for the new product cards ────── */
function injectStyles() {
    if (document.getElementById("fp-dynamic-styles")) return;
    const style = document.createElement("style");
    style.id = "fp-dynamic-styles";
    style.textContent = `
        /* Product grid override — remove any old grid styles set inline */
        #productsGrid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 20px;
        }

        /* Card */
        .fp-card {
            display: block;
            text-decoration: none;
            color: inherit;
            background: var(--clr-surface, #fff);
            border: 1px solid var(--clr-border, #e8e4de);
            border-radius: 12px;
            overflow: hidden;
            transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .fp-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.10);
            border-color: rgba(181,129,62,0.35);
        }

        /* Image */
        .fp-img-wrap {
            aspect-ratio: 1 / 1;
            overflow: hidden;
            background: #f5f2ee;
        }
        .fp-card .prod-img {
            width: 100%; height: 100%;
            object-fit: cover; display: block;
            transition: transform 0.4s ease;
        }
        .fp-card:hover .prod-img { transform: scale(1.05); }
        .fp-card .prod-img-ph {
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            font-size: 2.6rem; opacity: 0.22; color: #6b6560;
        }

        /* Info */
        .fp-info { padding: 14px 16px 16px; }
        .fp-name {
            font-size: 0.9rem; font-weight: 500; line-height: 1.35;
            margin-bottom: 7px;
            display: -webkit-box; -webkit-line-clamp: 2;
            -webkit-box-orient: vertical; overflow: hidden;
        }
        .fp-price-row { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
        .fp-price {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 1.05rem; font-weight: 600;
        }
        .fp-original {
            font-size: 0.78rem; color: #6b6560;
            text-decoration: line-through;
        }
        .fp-badge {
            font-size: 0.68rem; font-weight: 500;
            background: #f3ead8; color: #b5813e;
            padding: 2px 7px; border-radius: 20px;
        }

        /* Skeleton */
        .fp-skel { pointer-events: none; }
        .fp-skel-img {
            aspect-ratio: 1/1;
            background: linear-gradient(90deg,#ede9e3 25%,#e4dfd8 50%,#ede9e3 75%);
            background-size: 200% 100%;
            animation: fp-shimmer 1.4s infinite;
        }
        .fp-skel-body { padding: 14px 16px 16px; }
        .fp-skel-line {
            height: 13px; width: 80%; border-radius: 6px; margin-bottom: 8px;
            background: linear-gradient(90deg,#ede9e3 25%,#e4dfd8 50%,#ede9e3 75%);
            background-size: 200% 100%;
            animation: fp-shimmer 1.4s infinite;
        }
        .fp-skel-line--short { width: 45%; height: 16px; margin-bottom: 0; }
        @keyframes fp-shimmer {
            0%  { background-position: 200% 0; }
            100%{ background-position: -200% 0; }
        }

        /* Empty / error */
        .fp-empty {
            grid-column: 1 / -1;
            text-align: center;
            padding: 64px 24px;
            color: #6b6560;
        }
        .fp-empty i { font-size: 1.8rem; display: block; margin-bottom: 12px; opacity: 0.35; }
        .fp-empty p { font-size: 0.9rem; }

        /* Tab loading state */
        .tab-loading {
            font-size: 0.82rem; color: #6b6560;
            padding: 8px 0; font-style: italic;
        }
    `;
    document.head.appendChild(style);
}

/* ─── Init ───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    syncCartBadge();
    injectStyles();
    buildFeaturedTabs();
});

// Also re-sync badge if user navigates back via browser history
window.addEventListener("pageshow", syncCartBadge);
/**
 * categories.js
 * Wires up all category-driven UI on the homepage:
 *   1. Navbar mega menu  ← getCategoryTree()
 *   2. "Shop by Category" section  ← getFeaturedCategories()
 *   3. Footer "Shop" column  ← getAllCategories() (top-level only)
 *
 * Import this script at the bottom of index.html as a module:
 *   <script type="module" src="js/categories.js"></script>
 */

import {
    getCategoryTree,
    getAllCategories,
    resolveThumbnail
} from "./categoryService.js";

/* ─────────────────────────────────────────────
   1. NAVBAR MEGA MENU
   Replaces the static .mega-col divs with
   dynamic columns built from the category tree.
───────────────────────────────────────────── */
async function buildNavMegaMenu() {
    const megaGrid = document.querySelector(".mega-grid");
    if (!megaGrid) return;

    try {
        const { tree } = await getCategoryTree();
        if (!tree || tree.length === 0) return; // Keep static HTML as fallback

        // Build one .mega-col per top-level category
        const cols = tree.map((topCat) => {
            const children = topCat.children || [];
            const childLinks = children
                .map(
                    (child) =>
                        `<li>
                            <a href="/shop?slug=${encodeURIComponent(child.slug)}">
                                <i class="fas fa-chevron-right"></i>
                                ${escapeHtml(child.name)}
                            </a>
                        </li>`
                )
                .join("");

            return `
                <div class="mega-col">
                    <h4>
                        <a href="/category?slug=${encodeURIComponent(topCat.slug)}" class="mega-col-heading-link">
                            ${escapeHtml(topCat.name)}
                        </a>
                    </h4>
                    <ul class="mega-links">
                        ${childLinks || `<li><a href="/category?slug=${encodeURIComponent(topCat.slug)}"><i class="fas fa-chevron-right"></i> View All</a></li>`}
                    </ul>
                </div>`;
        });

        megaGrid.innerHTML = cols.join("");
    } catch (err) {
        // Silently fall back to the static HTML already in the DOM
        console.warn("[Dreak Trading] Mega menu API unavailable, using static fallback.", err);
    }
}

/* ─────────────────────────────────────────────
   2. SHOP BY CATEGORY SECTION
   Replaces static .cat-card elements with
   featured categories from the API.
   Falls back gracefully to static cards on error.
───────────────────────────────────────────── */

// Default emoji icons to use when a category has no thumbnail
const CAT_EMOJI_FALLBACKS = ["🛋️", "🛏️", "🍽️", "💼", "🪴", "🪞", "🖼️", "🏡"];

async function buildCategorySection() {
    const grid = document.querySelector(".categories-grid");
    if (!grid) return;

    // Show skeleton loaders while fetching
    grid.innerHTML = Array(6)
        .fill(
            `<div class="cat-card cat-skeleton">
                <div class="cat-skeleton-icon"></div>
                <div class="cat-skeleton-text"></div>
                <div class="cat-skeleton-sub"></div>
            </div>`
        )
        .join("");

    try {
        const { categories } = await getAllCategories();

        if (!categories || categories.length === 0) {
            // Restore original static content if API returns empty
            grid.innerHTML = buildStaticCategoryFallback();
            return;
        }

        const toplevel = categories.filter((c) => !c.parent);
        if (toplevel.length === 0) return;

        grid.innerHTML = toplevel
            .map((cat, i) => {
                const hasThumbnail = !!cat.thumbnail;
                const thumbUrl = resolveThumbnail(cat.thumbnail);
                const emoji = CAT_EMOJI_FALLBACKS[i % CAT_EMOJI_FALLBACKS.length];

                return `
                    <a href="/category?slug=${encodeURIComponent(cat.slug)}" class="cat-card cat-card--link" aria-label="Browse ${escapeHtml(cat.name)}">
                        ${hasThumbnail
                        ? `<div class="cat-thumb" role="img" aria-hidden="true" style="background-image:url('${thumbUrl}')"></div>`
                        : `<span class="cat-icon" aria-hidden="true">${emoji}</span>`
                    }
                        <div class="cat-name">${escapeHtml(cat.name)}</div>
                        <div class="cat-count">Shop Now</div>
                    </a>`;
            })
            .join("");
    } catch (err) {
        console.warn("[Dreak Trading] Featured categories unavailable, using static fallback.", err);
        grid.innerHTML = buildStaticCategoryFallback();
    }
}

function buildStaticCategoryFallback() {
    return `
        <div class="cat-card"><span class="cat-icon">🛋️</span><div class="cat-name">Living Room</div><div class="cat-count">84 Items</div></div>
        <div class="cat-card"><span class="cat-icon">🛏️</span><div class="cat-name">Bedroom</div><div class="cat-count">63 Items</div></div>
        <div class="cat-card"><span class="cat-icon">🍽️</span><div class="cat-name">Dining Room</div><div class="cat-count">47 Items</div></div>
        <div class="cat-card"><span class="cat-icon">💼</span><div class="cat-name">Home Office</div><div class="cat-count">56 Items</div></div>
        <div class="cat-card"><span class="cat-icon">🪴</span><div class="cat-name">Outdoor</div><div class="cat-count">38 Items</div></div>
        <div class="cat-card"><span class="cat-icon">🪞</span><div class="cat-name">Decor &amp; Accents</div><div class="cat-count">120 Items</div></div>`;
}

/* ─────────────────────────────────────────────
   3. FOOTER "SHOP" COLUMN
   Replaces static <li> links with top-level
   categories from the flat getAllCategories list.
───────────────────────────────────────────── */
async function buildFooterShopLinks() {
    // Target the <ul> inside the footer column whose <h4> is "Shop"
    const footerShopUl = findFooterShopUl();
    if (!footerShopUl) return;

    try {
        const { categories } = await getAllCategories();
        if (!categories || categories.length === 0) return;

        // Only top-level categories (no parent) in footer
        const topLevel = categories.filter((c) => !c.parent);

        if (topLevel.length === 0) return;

        footerShopUl.innerHTML = topLevel
            .map(
                (cat) =>
                    `<li>
                        <a href="/category?slug=${encodeURIComponent(cat.slug)}">
                            ${escapeHtml(cat.name)}
                        </a>
                    </li>`
            )
            .join("");
    } catch (err) {
        console.warn("[Dreak Trading] Footer shop links API unavailable, using static fallback.", err);
    }
}

function findFooterShopUl() {
    const footerCols = document.querySelectorAll(".footer-col");
    for (const col of footerCols) {
        const heading = col.querySelector("h4");
        if (heading && heading.textContent.trim().toLowerCase() === "shop") {
            return col.querySelector("ul");
        }
    }
    return null;
}

/* ─────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────── */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* ─────────────────────────────────────────────
   INIT — Run all three in parallel
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    Promise.all([
        buildNavMegaMenu(),
        buildCategorySection(),
        buildFooterShopLinks(),
    ]);
});
/**
 * productService.js
 * Centralised product API layer with in-memory caching.
 * Import this wherever you need to fetch products.
 */

import { BASE_URL } from "../config.js";
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const _cache = {};

function _setCache(key, data) {
    _cache[key] = { data, ts: Date.now() };
}
function _getCache(key) {
    const e = _cache[key];
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL) { delete _cache[key]; return null; }
    return e.data;
}

/**
 * Fetch products with optional filters.
 * @param {Object} opts
 * @param {string}  [opts.category]  - category slug
 * @param {string}  [opts.sort]      - newest | oldest | price_asc | price_desc
 * @param {number}  [opts.page]
 * @param {number}  [opts.limit]
 * @param {string}  [opts.search]
 * @param {number}  [opts.minPrice]
 * @param {number}  [opts.maxPrice]
 * @param {string}  [opts.color]
 * @param {string}  [opts.material]
 * @param {string}  [opts.size]
 */
export async function getProducts(opts = {}) {
    const q = new URLSearchParams();
    if (opts.category) q.set("category", opts.category);
    if (opts.sort) q.set("sort", opts.sort);
    if (opts.page) q.set("page", opts.page);
    if (opts.limit) q.set("limit", opts.limit);
    if (opts.search) q.set("search", opts.search);
    if (opts.minPrice) q.set("minPrice", opts.minPrice);
    if (opts.maxPrice) q.set("maxPrice", opts.maxPrice);
    if (opts.color) q.set("color", opts.color);
    if (opts.material) q.set("material", opts.material);
    if (opts.size) q.set("size", opts.size);

    const endpoint = `/product?${q.toString()}`;
    const cached = _getCache(endpoint);
    if (cached) return cached;

    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Unknown error");

    _setCache(endpoint, json);
    return json;
}

/**
 * Resolve a product's primary image URL.
 * @param {Array}  images  - product.images array
 * @param {string} [fallback]
 */
export function getPrimaryImage(images = [], fallback = "") {
    const primary = images.find(i => i.isPrimary) || images[0];
    return primary?.url || fallback;
}

/**
 * Compute the final price of a variant after discount.
 * @param {Object} variant
 */
export function variantFinalPrice(variant) {
    if (!variant) return 0;
    const d = variant.discountPercentage || 0;
    return d > 0 ? variant.price * (1 - d / 100) : variant.price;
}

/**
 * Format a number as Indian Rupee string.
 * e.g. 75000 → "₹75,000"
 */
export function formatINR(num) {
    return "₹" + Math.round(Number(num)).toLocaleString("en-IN");
}
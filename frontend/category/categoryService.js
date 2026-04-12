/**
 * categoryService.js
 * Centralised API layer for all category-related data fetching.
 * Uses in-memory caching to avoid redundant network calls within a session.
 */

import { BASE_URL } from "../config.js";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const _cache = {};

function _setCache(key, data) {
    _cache[key] = { data, ts: Date.now() };
}

function _getCache(key) {
    const entry = _cache[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        delete _cache[key];
        return null;
    }
    return entry.data;
}

async function _fetch(endpoint) {
    const cached = _getCache(endpoint);
    if (cached) return cached;

    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API error ${res.status} on ${endpoint}`);

    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Unknown API error");

    _setCache(endpoint, json);
    return json;
}

/**
 * Flat list of all active categories.
 * Fields: _id, name, slug, parent, thumbnail
 * Use for: footer shop links, full category browse page
 */
export async function getAllCategories() {
    return _fetch("/category");
}

/**
 * Full nested tree of active categories.
 * Each node has: _id, name, slug, thumbnail, sortOrder, children[]
 * Use for: navbar mega menu
 */
export async function getCategoryTree() {
    return _fetch("/category/tree");
}

/**
 * Up to 8 featured active categories.
 * Fields: _id, name, slug, thumbnail
 * Use for: "Shop by Category" homepage section
 */
export async function getFeaturedCategories() {
    return _fetch("/category/featured");
}

/**
 * Single category by slug + its direct children.
 * Use for: category detail page (category.html?slug=...)
 * @param {string} slug
 */
export async function getCategoryBySlug(slug) {
    return _fetch(`/category/${encodeURIComponent(slug)}`);
}

/**
 * Resolve a thumbnail path to a full URL.
 * The backend stores paths as "/uploads/images/filename.jpg"
 * @param {string} path
 * @param {string} [fallback] - URL to use when no thumbnail exists
 */
export function resolveThumbnail(path, fallback = "/images/category-placeholder.jpg") {
    if (!path) return fallback;
    if (path.startsWith("http")) return path;
    return `${BASE_URL}${path}`;
}
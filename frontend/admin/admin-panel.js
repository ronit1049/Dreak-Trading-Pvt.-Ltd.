import { BASE_URL } from "../config.js"

// ================================================================
// UTILITIES
// ================================================================

const showToast = (message, type = "info") => {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.classList.remove("show"); }, 3500);
};

const setMsg = (id, text, isSuccess) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `msg ${isSuccess ? "success" : "error"}`;
};

const statusBadgeClass = (status) => {
    const map = {
        Pending: "badge-yellow", Confirmed: "badge-blue", Processing: "badge-blue",
        Shipped: "badge-blue", Delivered: "badge-green", Cancelled: "badge-red"
    };
    return map[status] || "badge-gray";
};

const paymentBadgeClass = (status) => {
    return status === "Paid" ? "badge-green" : status === "Failed" ? "badge-red" : "badge-yellow";
};

// ================================================================
// TAB SWITCHING
// ================================================================

const navItems = document.querySelectorAll(".nav-item");
const tabs = document.querySelectorAll(".tab-content");
const pageTitle = document.getElementById("page-title");

navItems.forEach(item => {
    item.addEventListener("click", () => {
        navItems.forEach(i => i.classList.remove("active"));
        tabs.forEach(tab => tab.classList.remove("active"));
        item.classList.add("active");
        const tabId = item.getAttribute("data-tab");
        document.getElementById(tabId).classList.add("active");
        pageTitle.innerText = item.innerText.trim();
    });
});

// Sub tabs — scoped so both category and product sub-tabs work independently
document.querySelectorAll(".tab-content").forEach(tabContent => {
    const subTabs = tabContent.querySelectorAll(".sub-tab");
    const subContents = tabContent.querySelectorAll(".sub-content");
    subTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            subTabs.forEach(t => t.classList.remove("active"));
            subContents.forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            tabContent.querySelector(`#${tab.dataset.subtab}`).classList.add("active");
        });
    });
});

// ================================================================
// ADMIN REGISTRATION
// ================================================================

document.getElementById("adminForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
        firstName: document.getElementById("firstName").value,
        lastName: document.getElementById("lastName").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    };
    try {
        const res = await fetch(`${BASE_URL}/auth/admin-sign-up`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data)
        });
        const result = await res.json();
        setMsg("responseMsg", result.message, res.ok);
        if (res.ok) {
            document.getElementById("adminForm").reset();
            showToast(result.message, "success");
        }
    } catch (err) {
        setMsg("responseMsg", "Server error. Please try again.", false);
        console.error(err);
    }
});

// ================================================================
// CATEGORY — Load & Populate
// ================================================================

let categoriesData = [];

const flattenCategories = (categories) => {
    let result = []

    categories.forEach(cat => {
        result.push(cat)
        if (cat.children && cat.children.length > 0) {
            result = result.concat(flattenCategories(cat.children))
        }
    })
    return result
}

const loadCategories = async () => {
    try {
        const res = await fetch("http://localhost:8000/category/", { credentials: "include" })
        const data = await res.json()

        categoriesData = flattenCategories(data.categories || [])

        populateCategoryDropdowns()
        populateProductCategories()
        populateUpdateProductCategories()
    } catch (err) {
        console.error("Failed to load categories:", err)
    }
};

const populateCategoryDropdowns = () => {
    const parentDropdown = document.getElementById("parentCategory");
    const deleteDropdown = document.getElementById("deleteCategorySelect");

    parentDropdown.innerHTML = `<option value="">— Top Level —</option>`;
    deleteDropdown.innerHTML = `<option value="">— Select Category —</option>`;

    categoriesData.forEach(cat => {
        const updateOpt = `<option value="${cat._id}">${cat.name}</option>`;
        deleteDropdown.innerHTML += updateOpt;

        if (cat.depth === 0) {
            parentDropdown.innerHTML += `<option value="${cat._id}">${cat.name}</option>`;
        }
    });
};

// ================================================================
// CATEGORY — Create
// ================================================================

document.getElementById("createCategoryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", document.getElementById("catName").value);
    formData.append("description", document.getElementById("catDesc").value);

    const parentValue = document.getElementById("parentCategory").value;
    if (parentValue) formData.append("parent", parentValue);

    const sortOrderVal = document.getElementById("sortOrder").value;
    if (sortOrderVal) formData.append("sortOrder", sortOrderVal);

    formData.append("isFeatured", document.getElementById("isFeatured").checked ? "true" : "false");

    const file = document.getElementById("catImage").files[0];
    if (file) formData.append("imageFile", file);

    try {
        const res = await fetch(`${BASE_URL}/category/create-category`, {
            method: "POST",
            credentials: "include",
            body: formData
        });
        const result = await res.json();
        setMsg("createCatMsg", result.message, res.ok);
        if (res.ok) {
            document.getElementById("createCategoryForm").reset();
            showToast("Category created successfully", "success");
            await loadCategories();
        }
    } catch (err) {
        setMsg("createCatMsg", "Server error", false);
        console.error(err);
    }
});

// ================================================================
// CATEGORY — Update
// ================================================================

document.getElementById("updateCategoryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("updateCategorySelect").value;
    if (!id) { setMsg("updateCatMsg", "Please select a category", false); return; }

    const formData = new FormData();
    const name = document.getElementById("updateName").value;
    const desc = document.getElementById("updateDesc").value;

    if (name) formData.append("name", name);
    if (desc) formData.append("description", desc);

    const file = document.getElementById("updateImage").files[0];
    if (file) formData.append("imageFile", file);

    try {
        const res = await fetch(`${BASE_URL}/category/update-category/${id}`, {
            method: "PATCH",
            credentials: "include",
            body: formData
        });
        const result = await res.json();
        setMsg("updateCatMsg", result.message, res.ok);
        if (res.ok) {
            showToast("Category updated", "success");
            await loadCategories();
        }
    } catch (err) {
        setMsg("updateCatMsg", "Server error", false);
        console.error(err);
    }
});

// ================================================================
// CATEGORY — Delete
// ================================================================

document.getElementById("deleteCategoryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("deleteCategorySelect").value;
    if (!id) { setMsg("deleteCatMsg", "Please select a category", false); return; }

    if (!confirm("Deactivate this category? It will no longer be visible to customers.")) return;

    try {
        const res = await fetch(`${BASE_URL}/category/delete-category/${id}`, {
            method: "DELETE",
            credentials: "include"
        });
        const result = await res.json();
        setMsg("deleteCatMsg", result.message, res.ok);
        if (res.ok) {
            showToast("Category deactivated", "info");
            await loadCategories();
        }
    } catch (err) {
        setMsg("deleteCatMsg", "Server error", false);
        console.error(err);
    }
});

// ================================================================
// PRODUCT — Category dropdowns
// ================================================================

const populateProductCategories = () => {
    const prodCategory = document.getElementById("prodCategory");

    prodCategory.innerHTML = `<option value="">— Select Category —</option>`;

    categoriesData.forEach(cat => {
        const option = `<option value="${cat._id}">${cat.name}</option>`;
        prodCategory.innerHTML += option;
    });
};

// ================================================================
// PRODUCT — Update: populate subcategories only
// ================================================================

const populateUpdateProductCategories = () => {
    const categorySelect = document.getElementById("updateProdCategory");
    categorySelect.innerHTML = `<option value="">— All Categories —</option>`;

    const subCategories = categoriesData.filter(cat => cat.depth === 1);

    subCategories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat._id}">${cat.name}</option>`;
    });
};

// ================================================================
// PRODUCT — Variant UI (create form)
// ================================================================

let variantCount = 0;

document.getElementById("addVariantBtn").addEventListener("click", () => {
    variantCount++;
    const div = document.createElement("div");
    div.className = "variant-card";
    div.dataset.variantIndex = variantCount;
    div.innerHTML = `
        <div class="variant-card-header">
            <span class="variant-card-title">Variant #${variantCount}</span>
            <button type="button" class="btn-close" onclick="this.closest('.variant-card').remove()">✕</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>SKU <span class="required">*</span></label>
                <input type="text" class="sku" placeholder="e.g. SOFA-001" required />
            </div>
            <div class="form-group">
                <label>Color</label>
                <input type="text" class="color" placeholder="e.g. Grey" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Size</label>
                <input type="text" class="size" placeholder="e.g. 3-seater" />
            </div>
            <div class="form-group">
                <label>Material</label>
                <input type="text" class="material" placeholder="e.g. Fabric" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Price (₹) <span class="required">*</span></label>
                <input type="number" class="price" placeholder="e.g. 30000" min="0" required />
            </div>
            <div class="form-group">
                <label>Discount %</label>
                <input type="number" class="discount" placeholder="0–90" min="0" max="90" />
            </div>
            <div class="form-group">
                <label>Stock <span class="required">*</span></label>
                <input type="number" class="stock" placeholder="e.g. 10" min="0" required />
            </div>
        </div>
    `;
    document.getElementById("variantContainer").appendChild(div);
});

// ================================================================
// PRODUCT — Create
// ================================================================

document.getElementById("createProductForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const variantCards = document.querySelectorAll("#variantContainer .variant-card");
    if (variantCards.length === 0) {
        setMsg("createProductMsg", "Please add at least one variant.", false);
        return;
    }

    const variants = [];
    variantCards.forEach(v => {
        variants.push({
            sku: v.querySelector(".sku").value,
            color: v.querySelector(".color").value,
            size: v.querySelector(".size").value,
            material: v.querySelector(".material").value,
            price: Number(v.querySelector(".price").value),
            discountPercentage: Number(v.querySelector(".discount").value) || 0,
            stock: Number(v.querySelector(".stock").value)
        });
    });

    const formData = new FormData();
    formData.append("name", document.getElementById("prodName").value);
    formData.append("description", document.getElementById("prodDesc").value);
    formData.append("shortDescription", document.getElementById("prodShortDesc").value);
    formData.append("category", document.getElementById("prodCategory").value);
    formData.append("brand", document.getElementById("brand").value);
    formData.append("warranty", document.getElementById("warranty").value);

    // Tags: split by comma, trim, JSON stringify
    const tagsRaw = document.getElementById("tags").value;
    const tagsArray = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
    formData.append("tags", JSON.stringify(tagsArray));

    // Specifications: validate JSON before sending
    const specsRaw = document.getElementById("specs").value.trim();
    if (specsRaw) {
        try {
            JSON.parse(specsRaw); // validate
            formData.append("specifications", specsRaw);
        } catch {
            setMsg("createProductMsg", "Specifications must be valid JSON.", false);
            return;
        }
    }

    formData.append("variants", JSON.stringify(variants));

    try {
        const res = await fetch(`${BASE_URL}/product/products`, {
            method: "POST",
            credentials: "include",
            body: formData
        });
        const data = await res.json();
        setMsg("createProductMsg", data.message, res.ok);
        if (res.ok) {
            document.getElementById("createProductForm").reset();
            document.getElementById("variantContainer").innerHTML = "";
            variantCount = 0;
            showToast("Product created. Upload images, then activate it.", "success");
            await loadProducts();
        }
    } catch (err) {
        setMsg("createProductMsg", "Server error", false);
        console.error(err);
    }
});

// ================================================================
// PRODUCT — Load
// ================================================================

let productsData = [];

const loadProducts = async () => {
    try {
        const statusEl = document.getElementById("productStatusFilter");
        const searchEl = document.getElementById("productSearch");

        const status = statusEl ? statusEl.value : "";
        const search = searchEl ? searchEl.value.trim() : "";

        let query = "?limit=10";
        if (status) query += `&status=${encodeURIComponent(status)}`;
        if (search) query += `&search=${encodeURIComponent(search)}`;
        // No status param = all products returned (active + inactive)

        const res = await fetch(`http://localhost:8000/product/products${query}`, {
            credentials: "include"
        });
        const data = await res.json();
        productsData = data.data || [];
        renderProducts();
    } catch (err) {
        console.error("Failed to load products:", err);
    }
};

let productsDataForUpdate = []
const loadAllProductsForUpdate = async () => {
    try {
        const res = await fetch(`http://localhost:8000/product/products?limit=200`, {
            credentials: "include"
        });
        const data = await res.json();
        productsDataForUpdate = data.data || [];
        renderProducts();
        populateUpdateProductCategories();
    } catch (err) {
        console.error("Failed to load products for update panel:", err);
    }
};

// ================================================================
// PRODUCT — Update: filter by category then select product
// ================================================================

document.getElementById("updateProdCategory").addEventListener("change", () => {
    const categoryId = document.getElementById("updateProdCategory").value;

    const filtered = categoryId
        ? productsData.filter(p => {
            // handle both populated object and plain string ID
            const catId = p.category?._id || p.category;
            return catId === categoryId;
        })
        : productsData;

    const select = document.getElementById("updateProductSelect");
    select.innerHTML = `<option value="">— Select Product —</option>`;
    filtered.forEach(p => {
        select.innerHTML += `<option value="${p._id}">${p.name}</option>`;
    });
    document.getElementById("updateProductForm").style.display = "none";
});

document.getElementById("updateProductSelect").addEventListener("change", () => {
    const id = document.getElementById("updateProductSelect").value;
    if (!id) {
        document.getElementById("updateProductForm").style.display = "none";
        return;
    }

    const product = productsData.find(p => p._id === id);
    if (!product) {
        showToast("Product not found in local data, try reloading.", "error");
        return;
    }

    document.getElementById("updateProdName").value = product.name || "";
    document.getElementById("updateProdDesc").value = product.description || "";
    document.getElementById("updateProdBrand").value = product.brand || "";
    document.getElementById("updateProdWarranty").value = product.warranty || "";
    document.getElementById("updateProductForm").style.display = "block";
});

document.getElementById("updateProductForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("updateProductSelect").value;
    if (!id) return;

    const formData = new FormData();
    const name = document.getElementById("updateProdName").value;
    const desc = document.getElementById("updateProdDesc").value;
    const brand = document.getElementById("updateProdBrand").value;
    const warranty = document.getElementById("updateProdWarranty").value;

    if (name) formData.append("name", name);
    if (desc) formData.append("description", desc);
    if (brand) formData.append("brand", brand);
    if (warranty) formData.append("warranty", warranty);

    try {
        const res = await fetch(`http://localhost:8000/product/products/${id}`, {
            method: "PATCH",
            credentials: "include",
            body: formData
        });
        const data = await res.json();
        setMsg("updateProductMsg", data.message, res.ok);
        if (res.ok) {
            showToast("Product updated", "success");
            await loadAllProductsForUpdate();
        }
    } catch (err) {
        setMsg("updateProductMsg", "Server error", false);
        console.error(err);
    }
});

// ================================================================
// PRODUCT — Render table
// ================================================================

const renderProducts = () => {
    const tbody = document.querySelector("#productTable tbody");
    tbody.innerHTML = "";

    if (!productsData.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-faint);padding:32px">No products found</td></tr>`;
        return;
    }

    productsData.forEach(product => {
        const category = categoriesData.find(c => c._id === product.category);
        const imageCount = product.images ? product.images.length : 0;
        const variantCount = product.variants ? product.variants.length : 0;

        const activateLabel = product.isActive ? "Deactivate" : "Activate";
        const activateClass = product.isActive ? "danger" : "success";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${product.name}</strong></td>
            <td>${category ? category.name : `<span style="color:var(--text-faint)">—</span>`}</td>
            <td>
                <span class="badge ${product.isActive ? "badge-green" : "badge-gray"}">
                    ${product.isActive ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <span class="badge ${product.isFeatured ? "badge-blue" : "badge-gray"}">
                    ${product.isFeatured ? "Featured" : "Standard"}
                </span>
            </td>
            <td style="color:var(--text-muted)">${imageCount} image${imageCount !== 1 ? "s" : ""}</td>
            <td style="color:var(--text-muted)">${variantCount} variant${variantCount !== 1 ? "s" : ""}</td>
            <td>
                <div class="td-actions">
                    <button class="btn-xs ${activateClass}" onclick="toggleStatus('${product._id}', ${!product.isActive})">${activateLabel}</button>
                    <button class="btn-xs info" onclick="toggleFeature('${product._id}', ${!product.isFeatured})">${product.isFeatured ? "Unfeature" : "Feature"}</button>
                    <button class="btn-xs neutral" onclick="openImageManager('${product._id}')">Images</button>
                    <button class="btn-xs neutral" onclick="openVariantManager('${product._id}')">Variants</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

// ================================================================
// PRODUCT — Toggle Status & Feature
// ================================================================

const toggleStatus = async (id, value) => {
    if (value === true) {
        const product = productsData.find(p => p._id === id);
        if (product && (!product.images || product.images.length === 0)) {
            showToast("Cannot activate: upload at least one image first.", "error");
            return;
        }
    }

    const res = await fetch(`${BASE_URL}/product/products/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: value })
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) await loadProducts();
};

const toggleFeature = async (id, value) => {
    const res = await fetch(`${BASE_URL}/product/products/${id}/feature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isFeatured: value })
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) await loadProducts();
};

// ================================================================
// PRODUCT — Image Manager
// ================================================================

let currentProductId = null;

const openImageManager = (id) => {
    currentProductId = id;

    // Close variant manager if open
    document.getElementById("variantManager").style.display = "none";

    const product = productsData.find(p => p._id === id);
    const container = document.getElementById("imageList");
    container.innerHTML = "";

    if (product.images && product.images.length > 0) {
        product.images.forEach(img => {
            const div = document.createElement("div");
            div.className = "image-item";
            div.innerHTML = `
                <img src="${BASE_URL}${img.url}" alt="product image" />
                <button onclick="deleteImage('${img._id}')">✕</button>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = `<p style="color:var(--text-faint);font-size:13px">No images uploaded yet.</p>`;
    }

    document.getElementById("imageManager").style.display = "block";
};

const closeImageManager = () => {
    document.getElementById("imageManager").style.display = "none";
    document.getElementById("imageUpload").value = "";
    document.getElementById("imageList").innerHTML = "";
};

const uploadImages = async () => {
    if (!currentProductId) return;
    const files = document.getElementById("imageUpload").files;
    if (!files.length) { showToast("Please select at least one image.", "error"); return; }

    const formData = new FormData();
    for (let file of files) {
        formData.append("images", file);
    }
    const res = await fetch(`${BASE_URL}/product/products/${currentProductId}/images`, {
        method: "POST",
        credentials: "include",
        body: formData
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) {
        await loadProducts();
        openImageManager(currentProductId); // refresh image list
    }
};

const deleteImage = async (imageId) => {
    if (!confirm("Remove this image?")) return;
    const res = await fetch(`${BASE_URL}/product/products/${currentProductId}/images/${imageId}`, {
        method: "DELETE",
        credentials: "include"
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) {
        await loadProducts();
        openImageManager(currentProductId); // refresh image list
    }
};

// ================================================================
// PRODUCT — Variant Manager
// ================================================================

const openVariantManager = (id) => {
    currentProductId = id;

    // Close image manager if open
    document.getElementById("imageManager").style.display = "none";

    const product = productsData.find(p => p._id === id);
    const container = document.getElementById("variantList");
    container.innerHTML = "";

    if (!product.variants || product.variants.length === 0) {
        container.innerHTML = `<p style="color:var(--text-faint);font-size:13px">No variants yet.</p>`;
    } else {
        product.variants.forEach(v => {
            const div = document.createElement("div");
            div.className = "variant-row";
            div.innerHTML = `
                <div class="variant-row-fields">
                    <div class="form-group" style="margin:0">
                        <label>SKU</label>
                        <input value="${v.sku}" id="sku-${v._id}" />
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Price (₹)</label>
                        <input type="number" value="${v.price}" id="price-${v._id}" />
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Stock</label>
                        <input type="number" value="${v.stock}" id="stock-${v._id}" />
                    </div>
                </div>
                <div class="variant-row-actions">
                    <button class="btn-xs success" onclick="updateVariant('${v._id}')">Save</button>
                    <button class="btn-xs danger" onclick="deleteVariant('${v._id}')">Delete</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    document.getElementById("variantManager").style.display = "block";
};

const closeVariantManager = () => {
    document.getElementById("variantManager").style.display = "none";
};

const addNewVariant = async () => {
    // Replaced prompt() with an inline mini-form for better UX
    const container = document.getElementById("variantList");
    if (document.getElementById("newVariantForm")) return; // prevent duplicate

    const div = document.createElement("div");
    div.id = "newVariantForm";
    div.className = "variant-row";
    div.style.borderColor = "rgba(200,240,110,0.3)";
    div.innerHTML = `
        <div class="variant-row-fields">
            <div class="form-group" style="margin:0">
                <label>SKU <span class="required">*</span></label>
                <input id="newSku" placeholder="e.g. SOFA-002" />
            </div>
            <div class="form-group" style="margin:0">
                <label>Price (₹) <span class="required">*</span></label>
                <input type="number" id="newPrice" placeholder="e.g. 30000" />
            </div>
            <div class="form-group" style="margin:0">
                <label>Stock <span class="required">*</span></label>
                <input type="number" id="newStock" placeholder="e.g. 10" min="0" />
            </div>
        </div>
        <div class="form-row" style="margin:0 0 10px 0">
            <div class="form-group" style="margin:0">
                <label>Color</label>
                <input id="newColor" placeholder="e.g. Grey" />
            </div>
            <div class="form-group" style="margin:0">
                <label>Size</label>
                <input id="newSize" placeholder="e.g. 3-seater" />
            </div>
        </div>
        <div class="form-row" style="margin:0 0 10px 0">
            <div class="form-group" style="margin:0">
                <label>Material</label>
                <input id="newMaterial" placeholder="e.g. Fabric" />
            </div>
            <div class="form-group" style="margin:0">
                <label>Discount %</label>
                <input type="number" id="newDiscount" placeholder="0–90" min="0" max="90" />
            </div>
        </div>
        <div class="variant-row-actions">
            <button class="btn-xs success" onclick="submitNewVariant()">Add Variant</button>
            <button class="btn-xs neutral" onclick="document.getElementById('newVariantForm').remove()">Cancel</button>
        </div>
    `;
    container.prepend(div);
};

const submitNewVariant = async () => {
    const sku = document.getElementById("newSku").value.trim();
    const price = document.getElementById("newPrice").value;
    const stock = document.getElementById("newStock").value;

    if (!sku || !price || stock === "") {
        showToast("SKU, price and stock are required.", "error");
        return;
    }

    const body = {
        sku,
        price: Number(price),
        stock: Number(stock),
        color: document.getElementById("newColor").value,
        size: document.getElementById("newSize").value,
        material: document.getElementById("newMaterial").value,
        discountPercentage: Number(document.getElementById("newDiscount").value) || 0
    };

    const res = await fetch(`${BASE_URL}/product/products/${currentProductId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) {
        await loadProducts();
        openVariantManager(currentProductId);
    }
};

const updateVariant = async (variantId) => {
    const sku = document.getElementById(`sku-${variantId}`).value;
    const price = document.getElementById(`price-${variantId}`).value;
    const stock = document.getElementById(`stock-${variantId}`).value;

    const res = await fetch(`${BASE_URL}/product/products/${currentProductId}/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sku, price: Number(price), stock: Number(stock) })
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) {
        await loadProducts();
        openVariantManager(currentProductId);
    }
};

const deleteVariant = async (variantId) => {
    if (!confirm("Remove this variant?")) return;
    const res = await fetch(`${BASE_URL}/product/products/${currentProductId}/variants/${variantId}`, {
        method: "DELETE",
        credentials: "include"
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) {
        await loadProducts();
        openVariantManager(currentProductId);
    }
};

// ================================================================
// ORDERS — Load & Filter
// ================================================================

let currentPage = 1;

const loadOrders = async (page = 1) => {
    currentPage = page;

    const search = document.getElementById("searchOrder").value.trim();
    const status = document.getElementById("filterStatus").value;
    const paymentStatus = document.getElementById("filterPayment").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;

    let query = `?page=${page}&limit=10`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    if (status) query += `&status=${encodeURIComponent(status)}`;
    if (paymentStatus) query += `&paymentStatus=${encodeURIComponent(paymentStatus)}`;
    if (dateFrom) query += `&dateFrom=${dateFrom}`;
    if (dateTo) query += `&dateTo=${dateTo}`;

    try {
        const res = await fetch(`${BASE_URL}/order/get-all-orders${query}`, {
            credentials: "include"
        });
        const data = await res.json();
        renderOrders(data.orders || []);
        renderPagination(data.page, data.totalPages);
    } catch (err) {
        console.error("Failed to load orders:", err);
    }
};

// ================================================================
// ORDERS — Render table
// ================================================================

const renderOrders = (orders) => {
    const tbody = document.querySelector("#orderTable tbody");
    tbody.innerHTML = "";

    if (!orders.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-faint);padding:32px">No orders found</td></tr>`;
        return;
    }

    orders.forEach(order => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong style="font-size:12px;font-family:monospace">${order.orderNumber}</strong></td>
            <td>${order.customerSnapshot.name}<br><span style="font-size:12px;color:var(--text-muted)">${order.customerSnapshot.email}</span></td>
            <td><strong>₹${order.totalAmount.toLocaleString("en-IN")}</strong></td>
            <td><span class="badge ${paymentBadgeClass(order.payment.status)}">${order.payment.status}</span></td>
            <td><span class="badge ${statusBadgeClass(order.orderStatus)}">${order.orderStatus}</span></td>
            <td style="color:var(--text-muted);font-size:12px">${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
            <td>
                <div class="td-actions">
                    <button class="btn-xs info"    onclick="viewOrder('${order._id}')">View</button>
                    <button class="btn-xs success" onclick="updateStatus('${order._id}', '${order.orderStatus}')">Status</button>
                    <button class="btn-xs neutral" onclick="addTracking('${order._id}', '${order.orderStatus}')">Track</button>
                    <button class="btn-xs danger"  onclick="cancelOrder('${order._id}', '${order.orderStatus}')">Cancel</button>
                    <button class="btn-xs neutral" onclick="downloadInvoice('${order._id}')">Invoice</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

// ================================================================
// ORDERS — Pagination
// ================================================================

const renderPagination = (page, totalPages) => {
    const container = document.getElementById("pagination");
    container.innerHTML = "";
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        if (i === page) btn.classList.add("active");
        btn.onclick = () => loadOrders(i);
        container.appendChild(btn);
    }
};

// ================================================================
// ORDERS — View Detail
// ================================================================

const viewOrder = async (id) => {
    try {
        const res = await fetch(`${BASE_URL}/order/get-order/${id}`, { credentials: "include" });
        const data = await res.json();
        const order = data.order;

        document.getElementById("orderDetailTitle").textContent = `Order ${order.orderNumber}`;

        const content = document.getElementById("orderDetailContent");
        content.innerHTML = `
            <div class="order-grid">
                <div class="order-section">
                    <h4>Customer</h4>
                    <p>${order.customerSnapshot.name}</p>
                    <p><span>${order.customerSnapshot.email}</span></p>
                </div>
                <div class="order-section">
                    <h4>Payment</h4>
                    <p>Method: ${order.payment.method}</p>
                    <p>Status: <span class="badge ${paymentBadgeClass(order.payment.status)}">${order.payment.status}</span></p>
                    ${order.payment.gateway ? `<p><span>Gateway: ${order.payment.gateway}</span></p>` : ""}
                </div>
                <div class="order-section">
                    <h4>Shipping Address</h4>
                    <p>${order.shippingAddress.fullName}</p>
                    <p><span>${order.shippingAddress.line1}${order.shippingAddress.line2 ? ", " + order.shippingAddress.line2 : ""}</span></p>
                    <p><span>${order.shippingAddress.city}, ${order.shippingAddress.state} — ${order.shippingAddress.pincode}</span></p>
                    <p><span>📞 ${order.shippingAddress.phone}</span></p>
                </div>
                ${order.tracking && order.tracking.courier ? `
                <div class="order-section">
                    <h4>Tracking</h4>
                    <p>Courier: ${order.tracking.courier}</p>
                    <p><span>ID: ${order.tracking.trackingId}</span></p>
                    ${order.tracking.trackingUrl ? `<p><a href="${order.tracking.trackingUrl}" target="_blank" style="color:var(--accent);font-size:13px">Track Package →</a></p>` : ""}
                </div>` : ""}
            </div>

            <h4 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-faint);margin-bottom:10px">Order Items</h4>
            <div class="table-wrapper" style="margin-bottom:20px">
                <table class="order-items-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Variant</th>
                            <th>Price</th>
                            <th>Discount</th>
                            <th>Qty</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td>
                                    ${item.image ? `<img src="${BASE_URL}${item.image}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:8px">` : ""}
                                    ${item.productName}
                                </td>
                                <td style="font-size:12px;color:var(--text-muted)">
                                    ${item.variant.sku} / ${item.variant.color} / ${item.variant.size}
                                </td>
                                <td>₹${item.price.toLocaleString("en-IN")}</td>
                                <td>${item.discountPercentage}%</td>
                                <td>${item.quantity}</td>
                                <td><strong>₹${item.totalPrice.toLocaleString("en-IN")}</strong></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>

            <div style="display:flex;gap:20px;align-items:flex-start">
                <div style="flex:1">
                    <h4 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-faint);margin-bottom:10px">Status History</h4>
                    <div class="status-timeline">
                        ${order.statusHistory.map((s, i) => `
                            <div class="timeline-item">
                                <div class="timeline-dot ${i < order.statusHistory.length - 1 ? "past" : ""}"></div>
                                <div class="timeline-body">
                                    <p>${s.status}</p>
                                    ${s.note ? `<span>${s.note} · </span>` : ""}
                                    <span>${new Date(s.updatedAt).toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <div class="order-totals">
                    <div class="total-row"><span>Subtotal</span><span>₹${order.subtotal.toLocaleString("en-IN")}</span></div>
                    <div class="total-row"><span>Shipping</span><span>₹${order.shippingCharge.toLocaleString("en-IN")}</span></div>
                    <div class="total-row"><span>Tax</span><span>₹${order.taxAmount.toLocaleString("en-IN")}</span></div>
                    <div class="total-row grand"><span>Total</span><span>₹${order.totalAmount.toLocaleString("en-IN")}</span></div>
                </div>
            </div>
        `;

        document.getElementById("orderDetailPanel").style.display = "block";
        document.getElementById("orderDetailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
        showToast("Failed to load order details", "error");
        console.error(err);
    }
};

const closeOrderDetail = () => {
    document.getElementById("orderDetailPanel").style.display = "none";
};

// ================================================================
// ORDERS — Update Status
// ================================================================

const STATUS_CHAIN = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered"];

const updateStatus = async (id, currentStatus) => {
    const currentIndex = STATUS_CHAIN.indexOf(currentStatus);
    const nextStatuses = STATUS_CHAIN.slice(currentIndex + 1);

    if (nextStatuses.length === 0) {
        showToast("This order is already delivered.", "info");
        return;
    }

    // Build a small select-based prompt
    const options = nextStatuses.map(s => `<option value="${s}">${s}</option>`).join("");
    const statusStr = nextStatuses.join(" / ");
    const status = prompt(`Current: ${currentStatus}\nNext valid status (${statusStr}):`);
    if (!status) return;

    if (!STATUS_CHAIN.includes(status)) {
        showToast(`Invalid status. Must be one of: ${statusStr}`, "error");
        return;
    }

    const note = prompt("Note (optional, press Enter to skip):");

    const res = await fetch(`${BASE_URL}/order/update-order-status/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, note: note || undefined })
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) loadOrders(currentPage);
};

// ================================================================
// ORDERS — Add Tracking
// ================================================================

const addTracking = async (id, currentStatus) => {
    const allowedStatuses = ["Shipped", "Delivered"];
    if (!allowedStatuses.includes(currentStatus)) {
        showToast("Tracking can only be added when order is Shipped or Delivered.", "error");
        return;
    }

    const courier = prompt("Courier name (e.g. BlueDart):");
    if (!courier) return;
    const trackingId = prompt("Tracking ID:");
    if (!trackingId) return;
    const trackingUrl = prompt("Tracking URL (optional):");

    const body = { courier, trackingId };
    if (trackingUrl) body.trackingUrl = trackingUrl;

    const res = await fetch(`${BASE_URL}/order/order-tracking/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
};

// ================================================================
// ORDERS — Cancel
// ================================================================

const cancelOrder = async (id, currentStatus) => {
    if (currentStatus === "Shipped" || currentStatus === "Delivered") {
        showToast(`Cannot cancel a ${currentStatus} order.`, "error");
        return;
    }
    if (currentStatus === "Cancelled") {
        showToast("This order is already cancelled.", "info");
        return;
    }

    const reason = prompt("Reason for cancellation:");
    if (!reason) return;

    const res = await fetch(`${BASE_URL}/order/order-cancel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason })
    });
    const data = await res.json();
    showToast(data.message, res.ok ? "success" : "error");
    if (res.ok) loadOrders(currentPage);
};

// ================================================================
// ORDERS — Invoice
// ================================================================

const downloadInvoice = (id) => {
    window.open(`${BASE_URL}/order/generate-invoice/${id}`, "_blank");
};

// ================================================================
// ORDERS — Auto-load when tab is opened
// ================================================================

document.querySelector('[data-tab="order"]').addEventListener("click", () => {
    loadOrders();
});

// ================================================================
// PAYMENTS — Load & Render
// ================================================================

let currentPaymentPage = 1;

const loadPayments = async (page = 1) => {
    currentPaymentPage = page;

    const status = document.getElementById("filterPaymentStatus").value;
    let query = `?page=${page}&limit=10`;
    if (status) query += `&status=${encodeURIComponent(status)}`;

    try {
        const res = await fetch(`${BASE_URL}/payment/admin-payment-info${query}`, {
            credentials: "include"
        });
        const data = await res.json();
        renderPayments(data.payments || []);

        renderPaymentPagination(page, data.payments || []);
    } catch (err) {
        console.error("Failed to load payments:", err);
        showToast("Failed to load payments", "error");
    }
};

const renderPayments = (payments) => {
    const tbody = document.getElementById("paymentTableBody");
    tbody.innerHTML = "";

    if (!payments.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-faint);padding:32px">No payment records found</td></tr>`;
        return;
    }

    payments.forEach(p => {
        const method = p.payment.method;
        const status = p.payment.status;
        const gatewayId = p.payment.gatewayPaymentId || null;

        // Refund is only applicable for online (Razorpay) orders that are Paid
        // COD orders have no gatewayPaymentId so refund is meaningless
        const canRefund = status === "Paid" && gatewayId;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong style="font-size:12px;font-family:monospace">${p.orderNumber}</strong></td>
            <td>
                <span class="badge ${method === "COD" ? "badge-gray" : "badge-blue"}">${method}</span>
            </td>
            <td style="font-size:12px;color:var(--text-muted);font-family:monospace">
                ${gatewayId
                ? `<span title="${gatewayId}">${gatewayId.length > 18 ? gatewayId.slice(0, 18) + "…" : gatewayId}</span>`
                : `<span style="color:var(--text-faint)">—</span>`}
            </td>
            <td><strong>₹${p.totalAmount.toLocaleString("en-IN")}</strong></td>
            <td><span class="badge ${paymentStatusBadgeClass(status)}">${status}</span></td>
            <td style="color:var(--text-muted);font-size:12px">
                ${new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </td>
            <td>
                ${canRefund
                ? `<button class="btn-xs danger" onclick="initiateRefund('${gatewayId}', '${p.orderNumber}', ${p.totalAmount})">Refund</button>`
                : status === "Refunded"
                    ? `<span class="badge badge-gray">Refunded</span>`
                    : `<span style="color:var(--text-faint);font-size:12px">—</span>`
            }
            </td>
        `;
        tbody.appendChild(row);
    });
};

// Separate badge map for payment statuses (includes Refunded)
const paymentStatusBadgeClass = (status) => {
    const map = {
        Paid: "badge-green",
        Pending: "badge-yellow",
        Failed: "badge-red",
        Refunded: "badge-gray"
    };
    return map[status] || "badge-gray";
};

// Simple pagination: show prev/next based on whether a full page came back
const renderPaymentPagination = (page, payments) => {
    const container = document.getElementById("paymentPagination");
    container.innerHTML = "";

    if (page > 1) {
        const prev = document.createElement("button");
        prev.textContent = "← Prev";
        prev.onclick = () => loadPayments(page - 1);
        container.appendChild(prev);
    }

    const label = document.createElement("span");
    label.textContent = `Page ${page}`;
    label.style.cssText = "padding:0 12px;font-size:13px;color:var(--text-muted);line-height:32px";
    container.appendChild(label);

    // If a full page (10 items) came back, there may be more
    if (payments.length === 10) {
        const next = document.createElement("button");
        next.textContent = "Next →";
        next.onclick = () => loadPayments(page + 1);
        container.appendChild(next);
    }
};

// ================================================================
// PAYMENTS — Refund
// ================================================================

const initiateRefund = async (gatewayPaymentId, orderNumber, amount) => {
    // Double-confirmation since refunds are irreversible
    const confirmed = confirm(
        `Refund ₹${amount.toLocaleString("en-IN")} for order ${orderNumber}?\n\nThis action is irreversible and will trigger a Razorpay refund.`
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`${BASE_URL}/payment/payment-refunds/${gatewayPaymentId}`, {
            method: "POST",
            credentials: "include"
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`Refund initiated for ${orderNumber}`, "success");
            await loadPayments(currentPaymentPage);
        } else {
            showToast(data.message || "Refund failed", "error");
        }
    } catch (err) {
        showToast("Server error during refund", "error");
        console.error(err);
    }
};

// ================================================================
// PAYMENTS — Search by Order Number
// ================================================================

const searchPaymentByOrder = async () => {
    const orderNumber = document.getElementById("paymentOrderSearch").value.trim();
    if (!orderNumber) {
        showToast("Please enter an order number.", "error");
        return;
    }

    try {
        // Step 1: use get-all-orders search to resolve the order number to a MongoDB _id
        const searchRes = await fetch(
            `${BASE_URL}/order/get-all-orders?search=${encodeURIComponent(orderNumber)}&limit=1`,
            { credentials: "include" }
        );
        const searchData = await searchRes.json();

        if (!searchData.orders || searchData.orders.length === 0) {
            showToast("No order found with that order number.", "error");
            return;
        }

        const orderId = searchData.orders[0]._id;

        // Step 2: fetch full order detail by _id
        const orderRes = await fetch(`${BASE_URL}/order/get-order/${orderId}`, {
            credentials: "include"
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) {
            showToast(orderData.message || "Failed to fetch order.", "error");
            return;
        }

        const order = orderData.order;

        // Step 3: render as a single-row payment table entry
        renderPayments([{
            orderNumber: order.orderNumber,
            payment: order.payment,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt
        }]);

        // Show the "currently filtered" banner
        document.getElementById("paymentSearchLabel").textContent = order.orderNumber;
        document.getElementById("paymentSearchBanner").style.display = "block";
        document.getElementById("paymentPagination").style.display = "none";

    } catch (err) {
        showToast("Server error during search.", "error");
        console.error(err);
    }
};

const clearPaymentSearch = () => {
    document.getElementById("paymentOrderSearch").value = "";
    document.getElementById("paymentSearchBanner").style.display = "none";
    document.getElementById("paymentPagination").style.display = "";
    loadPayments();
};

// Auto-load payments when tab opens
document.querySelector('[data-tab="payment"]').addEventListener("click", () => {
    loadPayments();
});

// ================================================================
// INIT
// ================================================================

const initAdminPanel = async () => {
    9
    await loadCategories();
    await loadProducts();
};

initAdminPanel();
import express from "express"
import { getAllProducts, getRelatedProducts, getProductBySlug } from "../controller/product-controller/user.js"
import { adminGetProducts, createProduct, updateProduct, updateProductStatus, updateProductFeature, addProductImages, deleteProductImage, addVariant, updateVariant, deleteVariant } from "../controller/product-controller/admin.js"
import { verifyAdmin } from "../middleware/authorization.js"
import upload from "../middleware/multer.js"


const productRouter = express.Router()

productRouter.get("/products", verifyAdmin, adminGetProducts)
// public routes
productRouter.get("/", getAllProducts)
productRouter.get("/:id/related", getRelatedProducts)
productRouter.get("/:slug", getProductBySlug)

// admin routes
productRouter.post("/products", upload.none(), verifyAdmin, createProduct)
productRouter.patch("/products/:id", upload.none(), verifyAdmin, updateProduct)
productRouter.patch("/products/:id/status", verifyAdmin, updateProductStatus)
productRouter.patch("/products/:id/feature", verifyAdmin, updateProductFeature)
productRouter.post("/products/:id/images", verifyAdmin, upload.array("images", 10), addProductImages)
productRouter.delete("/products/:id/images/:imageId", verifyAdmin, deleteProductImage)
productRouter.post("/products/:id/variants", verifyAdmin, addVariant)
productRouter.patch("/products/:id/variants/:variantId", verifyAdmin, updateVariant)
productRouter.delete("/products/:id/variants/:variantId", verifyAdmin, deleteVariant)

export default productRouter
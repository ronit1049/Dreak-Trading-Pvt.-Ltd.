import express from "express"
import { getAllCategories, getCategoryTree, getFeaturedCategories, getCategoryBySlug } from "../controller/category-controller/user.js"
import { createCategory, updateCategory, deleteCategory } from "../controller/category-controller/admin.js"
import upload from "../middleware/multer.js"
import { verifyAdmin } from "../middleware/authorization.js"

const categoryRouter = express.Router()

// public routes
categoryRouter.get("/", getAllCategories)
categoryRouter.get("/tree", getCategoryTree)
categoryRouter.get("/featured", getFeaturedCategories)
categoryRouter.get("/:slug", getCategoryBySlug)

// admin routes
categoryRouter.post("/create-category", verifyAdmin, upload.single("imageFile"), createCategory)
categoryRouter.patch("/update-category/:id", verifyAdmin, upload.single("imageFile"), updateCategory)
categoryRouter.delete("/delete-category/:id", verifyAdmin, deleteCategory)

export default categoryRouter
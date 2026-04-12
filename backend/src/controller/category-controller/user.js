import Category from "../../schema/category-schema.js"

export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).select("name slug parent thumbnail depth").sort({ sortOrder: 1 }).lean()

        res.status(200).json({
            success: true,
            categories
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const getCategoryTree = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).select("name slug parent thumbnail sortOrder").sort({ sortOrder: 1 }).lean()

        const map = {}
        const tree = []

        categories.forEach((cat) => {
            map[cat._id] = { ...cat, children: [] }
        })

        categories.forEach((cat) => {
            if (cat.parent) {
                map[cat.parent]?.children.push(map[cat._id])
            } else {
                tree.push(map[cat._id])
            }
        })

        res.status(200).json({
            success: true,
            tree
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const getFeaturedCategories = async (req, res) => {
    try {
        const categories = await Category.find({
            isActive: true,
            isFeatured: true
        }).select("name slug thumbnail").sort({ sortOrder: 1 }).limit(8)

        res.status(200).json({
            success: true,
            categories
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const getCategoryBySlug = async (req, res) => {
    try {
        const category = await Category.findOne({
            slug: req.params.slug,
            isActive: true
        })

        if (!category) {
            return res.status(404).json({ message: "Category not found" })
        }

        const children = await Category.find({
            parent: category._id,
            isActive: true
        }).select("name slug thumbnail")

        res.status(200).json({
            success: true,
            ...category.toObject(),
            children
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}
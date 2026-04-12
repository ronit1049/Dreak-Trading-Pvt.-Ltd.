import Product from "../../schema/product-schema.js"
import Category from "../../schema/category-schema.js"
import mongoose from "mongoose"

export const getAllProducts = async (req, res) => {
    try {
        let { category, minPrice, maxPrice, material, color, size, search, sort = 'newest', page = 1, limit = 10 } = req.query

        const pageNumber = Math.max(1, Number(page))
        const limitNumber = Math.min(50, Math.max(1, Number(limit)))
        const skip = (pageNumber - 1) * limitNumber

        const matchStage = { isActive: true }

        // category filter
        if (category) {
            const categoryDoc = await Category.findOne({
                slug: category,
                isActive: true
            }).lean()
            if (categoryDoc) {
                matchStage.category = categoryDoc._id
            } else {
                return res.status(200).json({
                    success: true,
                    products: [],
                    totalProducts: 0,
                    totalPages: 0,
                    page: pageNumber
                })
            }
        }

        // text search
        if (search) {
            matchStage.$text = { $search: search }
        }

        // variant filter
        const variantMatch = {}
        if (material) variantMatch.material = material
        if (color) variantMatch.color = color
        if (size) variantMatch.size = size

        if (minPrice || maxPrice) {
            variantMatch.price = {}
            if (minPrice) variantMatch.price.$gte = Number(minPrice)
            if (maxPrice) variantMatch.price.$lte = Number(maxPrice)
        }

        if (Object.keys(variantMatch).length > 0) {
            matchStage.variants = { $elemMatch: variantMatch }
        }

        // aggregation pipeline
        const pipeline = [
            { $match: matchStage },
            {
                $addFields: {
                    minPrice: { $min: "$variants.price" }
                }
            }
        ]


        // sorting
        switch (sort) {
            case "price_asc":
                pipeline.push({ $sort: { minPrice: 1 } })
                break
            case "price_desc":
                pipeline.push({ $sort: { minPrice: -1 } })
                break
            case "oldest":
                pipeline.push({ $sort: { createdAt: 1 } })
                break
            default:
                pipeline.push({ $sort: { createdAt: -1 } })
        }

        pipeline.push({ $skip: skip })
        pipeline.push({ $limit: limitNumber })

        const products = await Product.aggregate(pipeline)

        const total = await Product.countDocuments(matchStage)

        res.status(200).json({
            success: true,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            totalProducts: total,
            products
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const getProductBySlug = async (req, res) => {
    try {
        const product = await Product.findOne({
            slug: req.params.slug,
            isActive: true
        }).populate("category", "name slug").lean()

        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        res.status(200).json({
            success: true,
            product
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const getRelatedProducts = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid product ID" })
        }

        const product = await Product.findById(req.params.id).lean()
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        const related = await Product.find({
            category: product.category,
            _id: { $ne: product._id },
            isActive: true
        }).limit(6).select("name slug images variants").lean()

        res.status(200).json({
            success: true,
            related
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}
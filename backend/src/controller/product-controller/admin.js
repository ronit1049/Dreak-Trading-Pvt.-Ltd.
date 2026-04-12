import Product from "../../schema/product-schema.js"
import Category from "../../schema/category-schema.js"
import slugify from "slugify"
import mongoose from "mongoose"
import { deleteUploadedFile } from "../../middleware/multer.js"

const generateUniqueProductSlug = async (name, excludeId = null) => {
    const baseSlug = slugify(name, { lower: true, strict: true })
    let slug = baseSlug
    let counter = 1

    while (true) {
        const query = { slug }
        if (excludeId) {
            query._id = { $ne: excludeId }
        }

        const exists = await Product.findOne(query)
        if (!exists) break

        slug = `${baseSlug}-${counter}`
        counter++
    }
    return slug
}

const isValidBoolean = (value) => {
    return typeof value === 'boolean'
}

const validateVariantInput = (data) => {
    if (!data.sku) return "SKU is required"
    if (data.price == null || data.price < 0) return "Invalid price"
    if (data.stock == null || data.stock < 0) return "Invalid stock"
    if (data.discountPercentage != null) {
        if (data.discountPercentage < 0 || data.discountPercentage > 90)
            return "Invalid discount"
    }
    return null
}

export const adminGetProducts = async (req, res) => {
    try {
        let { status, search, page = 1, limit = 10 } = req.query

        const pageNumber = Math.max(1, Number(page))
        const limitNumber = Math.min(50, Math.max(1, Number(limit)))
        const skip = (pageNumber - 1) * limitNumber

        const query = {}

        if (status) {
            if (status === "active") query.isActive = true
            else if (status === "inactive") query.isActive = false
            else {
                return res.status(400).json({ message: "Invalid status value" })
            }
        }

        if (search) {
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { slug: { $regex: search, $options: "i" } }
            ];
        }

        const products = await Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNumber).populate("category", "name").lean()

        const total = await Product.countDocuments(query)

        res.status(200).json({
            success: true,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            totalProducts: total,
            hasNextPage: pageNumber < Math.ceil(total / limitNumber),
            hasPrevPage: pageNumber > 1,
            data: products
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const createProduct = async (req, res) => {
    try {
        const { name, description, shortDescription, category, warranty, brand, specifications, tags, metaTitle, metaDescription, variants } = req.body

        if (!name || !description || !category || !variants) {
            return res.status(400).json({ message: "Required fields are missing" })
        }

        if (!mongoose.Types.ObjectId.isValid(category)) {
            return res.status(400).json({ message: "Invalid category" })
        }

        const categoryDoc = await Category.findOne({ _id: category, isActive: true })
        if (!categoryDoc) {
            return res.status(400).json({ message: "Category not found or inactive" })
        }

        const slug = await generateUniqueProductSlug(name)

        let parsedVariants
        try {
            parsedVariants = JSON.parse(variants)
        } catch {
            return res.status(400).json({ message: "Invalid variants format" })
        }

        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
            return res.status(400).json({ message: "At least one variant required" })
        }

        // added this from claude
        for (const variant of parsedVariants) {
            const variantError = validateVariantInput(variant)
            if (variantError) {
                return res.status(400).json({ message: variantError })
            }
        }


        const product = await Product.create({
            name,
            slug,
            description,
            shortDescription,
            category,
            warranty,
            brand,
            specifications: (specifications && specifications.trim()) ? JSON.parse(specifications) : {},
            tags: (tags && tags.trim()) ? JSON.parse(tags) : [],
            metaTitle,
            metaDescription,
            variants: parsedVariants,
            createdBy: req.user._id
        })

    res.status(201).json({
        success: true,
        message: "Product created",
        product
    })
} catch (err) {
    console.error("Error: " + err)
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Server error",
        field: "name"
    })
}
}

export const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        if (req.body.name && req.body.name !== product.name) {
            product.name = req.body.name
            product.slug = await generateUniqueProductSlug(req.body.name, product._id)
        }

        if (req.body.category) {
            if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
                return res.status(400).json({ message: "Invalid category" })
            }

            const categoryDoc = await Category.findOne({
                _id: req.body.category,
                isActive: true
            })

            if (!categoryDoc) {
                return res.status(400).json({ message: "Category not found or inactive" })
            }

            product.category = req.body.category
        }

        Object.assign(product, {
            description: req.body.description ?? product.description,
            shortDescription:
                req.body.shortDescription ?? product.shortDescription,
            category: req.body.category ?? product.category,
            warranty: req.body.warranty ?? product.warranty,
            brand: req.body.brand ?? product.brand,
            metaTitle: req.body.metaTitle ?? product.metaTitle,
            metaDescription:
                req.body.metaDescription ?? product.metaDescription
        })

        if (req.body.tags) {
            product.tags = JSON.parse(req.body.tags)
        }

        if (req.body.specifications) {
            product.specifications = JSON.parse(req.body.specifications)
        }

        await product.save()

        res.status(200).json({
            success: true,
            message: "Product updated",
            product
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const updateProductStatus = async (req, res) => {
    try {
        const { isActive } = req.body

        if (!isValidBoolean(isActive)) {
            return res.status(400).json({ message: "isActive must be a boolean" })
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid product ID" })
        }

        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        if (isActive === true && product.images.length === 0) {
            return res.status(400).json({ message: "Cannot activate product without images" })
        }

        product.isActive = isActive
        await product.save()

        res.status(200).json({
            success: true,
            message: "Product status updated",
            isActive: product.isActive
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const updateProductFeature = async (req, res) => {
    try {
        const { isFeatured } = req.body

        if (!isValidBoolean(isFeatured)) {
            return res.status(400).json({ message: "isFeatured must be a boolean" })
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid product ID" })
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isFeatured },
            { new: true }
        )

        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        return res.status(200).json({
            success: true,
            message: "Product feature updated",
            product
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const addProductImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No images uploaded" })
        }

        const product = await Product.findById(req.params.id)
        if (!product) {
            req.files.forEach(file => {
                deleteUploadedFile(`/uploads/images/${file.filename}`)
            })
            return res.status(404).json({ message: "Product not found" })
        }

        const images = req.files.map(file => ({
            url: `/uploads/images/${file.filename}`,
            isPrimary: false
        }))

        product.images.push(...images)

        if (!product.images.some(img => img.isPrimary)) {
            product.images[0].isPrimary = true
        }

        await product.save()

        res.status(200).json({
            success: true,
            message: "Product images added",
            images: product.images
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const deleteProductImage = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid product ID" })
        }

        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        const image = product.images.id(req.params.imageId)
        if (!image) {
            return res.status(404).json({ message: "Image not found" })
        }

        const wasPrimary = image.isPrimary

        deleteUploadedFile(image.url)
        product.images.pull({ _id: image._id })

        if (wasPrimary && product.images.length > 0) {
            product.images[0].isPrimary = true
        }

        await product.save()

        return res.status(200).json({
            success: true,
            message: "Image removed"
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const addVariant = async (req, res) => {
    try {
        const error = validateVariantInput(req.body)
        if (error) {
            return res.status(400).json({ message: error })
        }

        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        if (product.variants.some(v => v.sku === req.body.sku)) {
            return res.status(400).json({ message: "SKU already exists" })
        }

        product.variants.push(req.body)

        await product.save()

        res.status(200).json({
            success: true,
            message: "Variant added",
            variants: product.variants
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const updateVariant = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        const variant = product.variants.id(req.params.variantId)
        if (!variant) {
            return res.status(404).json({ message: "Variant not found" })
        }

        const updatedData = { ...variant.toObject(), ...req.body }
        const error = validateVariantInput(updatedData)
        if (error) {
            return res.status(400).json({ message: error })
        }

        if (req.body.sku) {
            const duplicate = product.variants.some(
                v => v.sku === req.body.sku && v._id.toString() !== variant._id.toString()
            )
            if (duplicate) {
                return res.status(400).json({ message: "SKU already exists" })
            }
        }

        Object.assign(variant, req.body)
        await product.save()

        res.status(200).json({
            success: true,
            message: "Variant updated"
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const deleteVariant = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        if (product.variants.length <= 1) {
            return res.status(400).json({ message: "Product must have atleast one variant" })
        }

        const variant = product.variants.id(req.params.variantId)
        if (!variant) {
            return res.status(404).json({ message: "Variant not found" })
        }

        product.variants.pull({ _id: variant._id });
        await product.save();

        res.status(200).json({
            success: true,
            message: "Variant removed"
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}
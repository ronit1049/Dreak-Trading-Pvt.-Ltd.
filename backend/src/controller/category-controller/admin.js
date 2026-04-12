import Category from "../../schema/category-schema.js"
import slugify from "slugify"
import { deleteUploadedFile } from "../../middleware/multer.js"
import mongoose from "mongoose"

const MAX_DEPTH = 1 // 0 = top-level, 1 = sub

const generateUniqueSlug = async (name, parent, excludeId = null) => {
    const baseSlug = slugify(name, { lower: true, strict: true })
    let slug = baseSlug
    let counter = 1
    while (true) {
        const query = { slug, parent: parent || null }
        if (excludeId) query._id = { $ne: excludeId }

        const exists = await Category.findOne(query)
        if (!exists) break

        slug = `${baseSlug}-${counter}`
        counter++
    }

    return slug
}

const validateCategoryInput = (body) => {
    // Only convert if the field exists in the request
    if (body.isFeatured !== undefined) {
        body.isFeatured = body.isFeatured === 'true' || body.isFeatured === true;
    }
    if (!body.name || typeof body.name !== "string")
        return "Category name is required"
    if (body.name.length > 50)
        return "Name cannot exceed 50 characters"
    if (body.description && body.description.length > 500)
        return "Description too long"
    if (body.sortOrder) {
        body.sortOrder = Number(body.sortOrder);
        if (isNaN(body.sortOrder)) return "Sort order must be a number";
    }
    if (body.isFeatured !== undefined && typeof body.isFeatured !== "boolean")
        return "isFeatured must be boolean"

    return null
}

const checkCircularParent = async (categoryId, newParentId) => {
    let current = await Category.findById(newParentId)

    while (current) {
        if (current._id.toString() === categoryId.toString())
            return true

        if (!current.parent)
            break

        current = await Category.findById(current.parent)
    }

    return false
}

export const createCategory = async (req, res) => {
    try {
        const error = validateCategoryInput(req.body)
        if (error) {
            return res.status(400).json({ message: error })
        }

        let { name, description, parent, isFeatured, sortOrder } = req.body

        let parentCategory = null
        let depth = 0
        if (parent) {
            if (!mongoose.Types.ObjectId.isValid(parent)) {
                return res.status(400).json({ message: "Invalid parent ID" })
            }

            parentCategory = await Category.findById(parent)
            if (!parentCategory) {
                return res.status(400).json({ message: "Category not found" })
            }

            depth = parentCategory.depth + 1
            if (depth > MAX_DEPTH) {
                return res.status(400).json({ message: "Maximum category depth exceeded" })
            }
        }

        const slug = await generateUniqueSlug(name, parent)

        const category = await Category.create({
            name,
            slug,
            description,
            parent: parent || null,
            depth,
            isFeatured: isFeatured ?? false,
            sortOrder: sortOrder ?? 0,
            thumbnail: req.file ? `/uploads/images/${req.file.filename}` : "",
            createdBy: req.user._id
        })

        return res.status(201).json({
            success: true,
            message: "Category created",
            category
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

export const updateCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id)
        if (!category) {
            return res.status(404).json({ message: "Category not found" })
        }

        const error = validateCategoryInput({ ...category.toObject(), ...req.body })
        if (error) {
            return res.status(400).json({ message: "Error" })
        }
        if (req.body.parent) {
            if (!mongoose.Types.ObjectId.isValid(req.body.parent))
                return res.status(400).json({ message: "Invalid parent ID" })

            if (req.body.parent === category._id.toString())
                return res.status(400).json({ message: "Cannot be its own parent" })

            const parentCategory = await Category.findById(req.body.parent)
            if (!parentCategory) {
                return res.status(400).json({ message: "Parent not found" })
            }

            const isCircular = await checkCircularParent(category._id, req.body.parent)
            if (isCircular) {
                return res.status(400).json({ message: "Circular parent detected" })
            }

            const newDepth = parentCategory.depth + 1
            if (newDepth > MAX_DEPTH)
                return res.status(400).json({ message: "Maximum depth exceeded" })
            category.parent = req.body.parent
            category.depth = newDepth
        }

        if (req.body.name && req.body.name !== category.name) {
            category.name = req.body.name
            category.slug = await generateUniqueSlug(
                req.body.name,
                category.parent,
                category._id
            )
        }

        if (req.file) {
            deleteUploadedFile(category.thumbnail)
            category.thumbnail = `/uploads/images/${req.file.filename}`
        }

        category.description = req.body.description ?? category.description
        category.isFeatured = req.body.isFeatured ?? category.isFeatured
        category.sortOrder = req.body.sortOrder ?? category.sortOrder
        category.metaTitle = req.body.metaTitle ?? category.metaTitle
        category.metaDescription = req.body.metaDescription ?? category.metaDescription

        await category.save()
        res.status(200).json({
            success: true,
            message: "Category updated",
            category
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

export const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id)
        if (!category) {
            return res.status(404).json({ message: "Category not found" })
        }

        const deactivateRecursively = async (categoryId) => {
            await Category.updateOne(
                { _id: categoryId },
                { isActive: false }
            )
            const children = await Category.find({ parent: categoryId })
            for (const child of children) {
                await deactivateRecursively(child._id)
            }
        }
        await deactivateRecursively(category._id)
        res.status(200).json({
            success: true,
            message: "Category deactivated"
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
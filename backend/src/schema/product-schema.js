import mongoose from "mongoose"
const { Schema } = mongoose

// image sub-schema
const imageSchema = new Schema(
    {
        url: {
            type: String,
            required: true
        },
        publicId: String,
        isPrimary: {
            type: Boolean,
            default: false
        },
    },
    { _id: true }
)

// variant sub-schema
const variantSchema = new Schema(
    {
        sku: {
            type: String,
            required: true,
            trim: true
        },
        color: {
            type: String,
            trim: true
        },
        size: {
            type: String,
            trim: true
        },
        material: {
            type: String,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        discountPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 90
        },
        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        }
    },
    { _id: true }
)
variantSchema.index({ sku: 1 }, { unique: true })

// product schema
const productSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    slug: {
        type: String,
        required: true,
        lowercase: true,
        index: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        maxlength: 250,
        default: ""
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
        index: true
    },

    // image gallery
    images: {
        type: [imageSchema],
        default: []
    },
    // variants
    variants: {
        type: [variantSchema],
        validate: v => v.length > 0
    },

    // general product information
    warranty: String,
    brand: String,

    // specifications
    specifications: {
        type: Map,
        of: String // e.g. weight -> 20kg, assembly -> required
    },

    // tags for search
    tags: [
        {
            type: String,
            trim: true,
            lowercase: true
        }
    ],

    // ratings
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalReviews: {
        type: Number,
        default: 0,
        min: 0
    },

    // admin controls
    isActive: {
        type: Boolean,
        default: false,
        index: true
    },
    isFeatured: {
        type: Boolean,
        default: false,
        index: true
    },

    // SEO
    metaTitle: String,
    metaDescription: String,

    // audit
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true })

// INDEXES

// search index
productSchema.index({
    name: "text",
    description: "text",
    tags: "text"
})

// for filtering
productSchema.index({ category: 1, isActive: 1 })
productSchema.index({ "variants.price": 1 })
productSchema.index({ "variants.stock": 1 })

export default mongoose.model("Product", productSchema)
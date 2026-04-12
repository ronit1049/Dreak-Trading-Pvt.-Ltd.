import mongoose from "mongoose"
const { Schema } = mongoose

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    slug: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    description: {
        type: String,
        maxlength: 500,
        default: ""
    },
    thumbnail: {
        type: String,
        default: ""
    },
    parent: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        default: null
    },
    depth: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    metaTitle: {
        type: String,
        maxlength: 60,
        default: ""
    },
    metaDescription: {
        type: String,
        maxlength: 160,
        default: ""
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true })

// Unique slug per parent
categorySchema.index({ slug: 1, parent: 1 }, { unique: true })

// Optimize parent queries
categorySchema.index({ parent: 1 })

export default mongoose.model("Category", categorySchema)

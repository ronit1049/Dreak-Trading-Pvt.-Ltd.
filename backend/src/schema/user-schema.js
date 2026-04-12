import mongoose from "mongoose";
const { Schema } = mongoose

const addressSchema = new Schema(
    {
        line1: String,
        line2: String,
        city: String,
        state: String,
        country: {
            type: String,
            default: "India",
        },
        pincode: String,
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
)

const userSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 30
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true,
        index: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false
    },
    role: {
        type: String,
        enum: ['customer', 'admin', 'manager', 'staff'],
        default: 'customer'
    },
    addresses: [addressSchema],
    isActive: {
        type: Boolean,
        default: true
    },
    phone: {
        type: String,
        match: /^[0-9]{10}$/
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true })

export default mongoose.model('User', userSchema)
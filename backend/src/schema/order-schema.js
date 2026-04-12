import mongoose from "mongoose"
const { Schema } = mongoose

// order item
const orderItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Product"
    },
    productName: String,
    productSlug: String,

    variant: {
        sku: String,
        color: String,
        size: String,
        material: String
    },

    image: String,
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
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
}, { _id: false })


// address snapshot
const addressSchema = new Schema({
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    line1: {
        type: String,
        required: true
    },
    line2: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
}, { _id: false })


// payment info
const paymentSchema = new Schema({
    method: {
        type: String,
        enum: ['COD', 'ONLINE', 'CARD', 'UPI', 'NET_BANKING', 'WALLET'],
        default: null
    },
    gateway: {
        type: String,
        enum: ['RAZORPAY'],
        default: null // null for COD(cash on delivery)
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    transactionId: String,
    paidAt: Date,
    amount: Number,
    gatewayOrderId: String,
    gatewayPaymentId: String,
    gatewaySignature: String
}, { _id: false })


// order status history
const statusHistorySchema = new Schema({
    status: String,
    updatedAt: {
        type: Date,
        default: Date.now
    },
    note: String
}, { _id: false })


// the order schema
const orderSchema = new Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    // customer
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    customerSnapshot: {
        name: String,
        email: String,
        phone: String
    },

    // items
    items: [orderItemSchema],

    // addresses
    shippingAddress: addressSchema,
    billingAddress: addressSchema,

    // payment
    payment: paymentSchema,

    // coupon
    coupon: {
        code: String,
        discountAmount: Number
    },

    // order totals
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    shippingCharge: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    // order status
    orderStatus: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
        default: 'Pending'
    },
    cancelReason: String,
    returnedAt: Date,
    cancelledAt: Date,

    // tracking
    tracking: {
        courier: String,
        trackingId: String,
        trackingUrl: String,
        shippedAt: Date,
        deliveredAt: Date
    },

    // status history
    statusHistory: [statusHistorySchema]
}, { timestamps: true })

orderSchema.index({ user: 1 })
orderSchema.index({ orderStatus: 1 })
orderSchema.index({ createdAt: -1 })

export default mongoose.model('Order', orderSchema)
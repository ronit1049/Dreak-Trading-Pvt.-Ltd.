import mongoose from "mongoose"
import Order from "../../schema/order-schema.js"
import Product from "../../schema/product-schema.js"
import User from "../../schema/user-schema.js"
import redisClient from "../../config/redis.js"
import razorpay from "../../config/razorpay.js"
import PDFDocument from "pdfkit"

const generateOrderNumber = () => {
    const ts = Date.now().toString(36).toUpperCase()
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `ORD-${ts}-${rand}`
}

// calculate discounted price
const getFinalPrice = (price, discountPercentage) => {
    return price - (price * discountPercentage) / 100
}

export const createOrder = async (req, res) => {
    const userId = req.user._id
    const { items, shippingAddress, billingAddress, paymentMethod } = req.body

    if (!items || !shippingAddress || !billingAddress || !paymentMethod) {
        return res.status(400).json({ message: "Required fields missing" })
    }
    if (items.length === 0) {
        return res.status(400).json({ message: "No items provided" })
    }

    // prevent double-click orders (5 seconds lock)
    const lockKey = `ORDER_LOCK:${userId}`
    const lock = await redisClient.set(lockKey, '1', { NX: true, EX: 5 })
    if (!lock) {
        return res.status(429).json({ message: "Order already processing" })
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const orderItems = []
        let subtotal = 0

        for (const item of items) {
            const { productId, variantId, quantity } = item

            const product = await Product.findOne({
                _id: productId,
                isActive: true,
            }).session(session)

            if (!product) throw new Error("Product not available")

            const variant = product.variants.id(variantId)
            if (!variant) throw new Error("Variant not found")

            // atomic stock deduction
            const result = await Product.updateOne(
                {
                    _id: productId,
                    "variants._id": variantId,
                    "variants.stock": { $gte: quantity }
                },
                {
                    $inc: { "variants.$.stock": -quantity }
                },
                { session }
            )

            if (result.modifiedCount === 0) {
                throw new Error(`Out of stock for ${product.name}`)
            }

            const finalPrice = getFinalPrice(
                variant.price,
                variant.discountPercentage
            )

            const totalPrice = finalPrice * quantity
            subtotal += totalPrice

            orderItems.push({
                productId: product._id,
                productName: product.name,
                productSlug: product.slug,
                variant: {
                    sku: variant.sku,
                    color: variant.color,
                    size: variant.size,
                    material: variant.material
                },
                image: product.images[0]?.url,
                price: variant.price,
                discountPercentage: variant.discountPercentage,
                quantity,
                totalPrice
            })
        }

        const shippingCharge = 0
        const taxAmount = 0
        const totalAmount = subtotal + shippingCharge + taxAmount

        const user = await User.findById(userId).session(session)

        const order = await Order.create(
            [
                {
                    orderNumber: generateOrderNumber(),
                    user: userId,
                    customerSnapshot: {
                        name: user.firstName + " " + user.lastName,
                        email: user.email,
                        phone: user.phone
                    },
                    items: orderItems,
                    shippingAddress,
                    billingAddress,
                    payment: {
                        method: paymentMethod,
                        status: paymentMethod === "COD" ? "Pending" : "Pending",
                        amount: totalAmount
                    },
                    subtotal,
                    shippingCharge,
                    taxAmount,
                    totalAmount,
                    statusHistory: [{ status: "Pending" }]
                }
            ],
            { session }
        )

        await session.commitTransaction()
        session.endSession()
        await redisClient.del(lockKey)

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            orderId: order[0]._id,
            orderNumber: order[0].orderNumber
        })
    } catch (err) {
        await session.abortTransaction()
        session.endSession()
        await redisClient.del(lockKey)
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const getMyOrders = async (req, res) => {
    try {
        const userId = req.user._id
        const page = parseInt(req.query.page) || 1
        const limit = Math.min(50, parseInt(req.query.limit) || 10)
        const skip = (page - 1) * limit

        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).select("orderNumber totalAmount orderStatus createdAt payment")

        const total = await Order.countDocuments({ user: userId })
        res.status(200).json({
            success: true,
            page,
            totalPages: Math.ceil(total / limit),
            orders
        })
    } catch (err) {
        console.log("get my order issue")
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const getOrderById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid order ID" })
        }

        const order = await Order.findById(req.params.id)

        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" })
        }

        res.status(200).json({
            success: true,
            order
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const cancelOrder = async (req, res) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const order = await Order.findById(req.params.id).session(session)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" })
        }

        if (!['Pending', 'Confirmed'].includes(order.orderStatus)) {
            return res.status(400).json({
                message: "Order cannot be cancelled at this stage"
            })
        }

        // Restore stock
        for (const item of order.items) {
            await Product.updateOne(
                {
                    _id: item.productId,
                    "variants.sku": item.variant.sku
                },
                {
                    $inc: { "variants.$.stock": item.quantity }
                },
                { session }
            )
        }
        order.orderStatus = "Cancelled"
        order.cancelledAt = new Date()
        order.cancelReason = req.body.cancelReason || ""
        order.statusHistory.push({ status: "Cancelled", note: req.body.cancelReason })

        await order.save({ session })

        await session.commitTransaction()
        session.endSession()

        return res.status(200).json({
            success: true,
            message: "Order cancelled"
        })
    } catch (err) {
        await session.abortTransaction()
        session.endSession()
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const retryPayment = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" })
        }

        if (order.orderStatus === "Cancelled") {
            return res.status(400).json({ message: "Cannot pay for cancelled order" })
        }

        if (order.orderStatus === "Paid") {
            return res.status(400).json({ message: "Order already paid" })
        }

        // razorpay order creation here
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(order.totalAmount * 100),
            currency: 'INR',
            receipt: order.orderNumber
        })

        order.payment.gateway = "RAZORPAY",
        order.payment.gatewayOrderId = razorpayOrder.id
        order.payment.status = "Pending"

        console.log(razorpayOrder)

        await order.save()

        res.status(200).json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount: Math.round(order.totalAmount * 100),
            key: process.env.RAZORPAY_KEY_ID,
            orderNumber: order.orderNumber,
            orderId: order._id,
            message: "Payment retry initiated",
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const generateInvoice = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid order ID" })
        }

        const order = await Order.findById(req.params.id)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        const doc = new PDFDocument()
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader(
            "Content-Disposition",
            `inline; filename=invoice-${order.orderNumber}.pdf`
        )

        doc.pipe(res)

        doc.fontSize(18).text("Invoice", { align: "center" })
        doc.moveDown()

        doc.fontSize(12).text(`Order: ${order.orderNumber}`)
        doc.text(`Date: ${order.createdAt.toDateString()}`)
        doc.text(`Customer: ${order.customerSnapshot.name}`)
        doc.text(`Email: ${order.customerSnapshot.email}`)
        doc.moveDown()

        doc.text("Items:")
        order.items.forEach((item) => {
            doc.text(`${item.productName} (${item.variant.sku}) x ${item.quantity} = ₹${item.totalPrice}`)
        })

        doc.moveDown()
        doc.text(`Subtotal: ₹${order.subtotal}`)
        doc.text(`Shipping: ₹${order.shippingCharge}`)
        doc.text(`Tax: ₹${order.taxAmount}`)
        doc.text(`Total: ₹${order.totalAmount}`)

        doc.end()
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}
import mongoose from "mongoose"
import Order from "../../schema/order-schema.js"
import Product from "../../schema/product-schema.js"
import User from "../../schema/user-schema.js"
import redisClient from "../../config/redis.js"
import razorpay from "../../config/razorpay.js"
import PDFDocument from "pdfkit"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

        const doc = new PDFDocument({ margin: 50 })

        doc.font(path.join(__dirname, "../../../fonts/NotoSans_Condensed-Black.ttf"))

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader(
            "Content-Disposition",
            `inline; filename=invoice-${order.orderNumber}.pdf`
        )

        doc.pipe(res)

        // ===== HEADER =====
        doc
            .fontSize(20)
            .text("INVOICE", { align: "right" })

        doc
            .fontSize(10)
            .text(`Order #: ${order.orderNumber}`, { align: "right" })
            .text(`Date: ${new Date(order.createdAt).toDateString()}`, { align: "right" })

        doc.moveDown()

        // ===== CUSTOMER INFO =====
        doc
            .fontSize(12)
            .text("Billed To:", { underline: true })

        doc
            .fontSize(10)
            .text(order.customerSnapshot.name)
            .text(order.customerSnapshot.email)

        doc.moveDown(2)

        // ===== TABLE HEADER =====
        const tableTop = doc.y

        const col1 = 50
        const col2 = 230
        const col3 = 350
        const col4 = 420
        const col5 = 490

        doc
            .fontSize(11)
            .text("Item", col1, tableTop)
            .text("SKU", col2, tableTop)
            .text("Qty", col3, tableTop)
            .text("Price", col4, tableTop)
            .text("Total", col5, tableTop)

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke()

        // ===== TABLE ROWS =====
        let y = tableTop + 25

        order.items.forEach((item) => {
            doc
                .fontSize(10)
                .text(item.productName, col1, y)
                .text(item.variant.sku, col2, y, { width: 100 })
                .text(item.quantity, col3, y)
                .text(`₹${item.price}`, col4, y)
                .text(`₹${item.totalPrice}`, col5, y)

            y += 20
        })

        doc.moveDown(2)

        // ===== TOTALS =====
        const summaryTop = y + 20

        doc.text(`Subtotal: ₹${order.subtotal}`, 400, summaryTop)
        doc.text(`Shipping: ₹${order.shippingCharge}`, 400, summaryTop + 15)
        doc.text(`Tax: ₹${order.taxAmount}`, 400, summaryTop + 30)

        doc
            .fontSize(12)
            .text(`Total: ₹${order.totalAmount}`, 400, summaryTop + 50)

        doc.end()
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
        })
    }
}
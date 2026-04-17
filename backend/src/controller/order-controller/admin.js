import mongoose from "mongoose"
import PDFDocument from "pdfkit"
import Order from "../../schema/order-schema.js"
import Product from "../../schema/product-schema.js"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// allowed status transitions
const allowedTransitions = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Processing", "Cancelled"],
    Processing: ["Shipped", "Cancelled"],
    Shipped: ["Delivered"],
    Delivered: [],
    Cancelled: [],
    Returned: []
}

export const getAllOrdersAdmin = async (req, res) => {
    try {
        const { status, paymentStatus, dateFrom, dateTo, search, page = 1, limit = 10 } = req.query
        const query = {}

        if (status) query.orderStatus = status
        if (paymentStatus) query["payment.status"] = paymentStatus

        if (dateFrom || dateTo) {
            query.createdAt = {}
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
            if (dateTo) query.createdAt.$lte = new Date(dateTo)
        }

        if (search) {
            query.orderNumber = { $regex: search, $options: "i" }
        }

        const pageNumber = Math.max(1, parseInt(page))
        const limitNumber = Math.min(100, Math.max(1, parseInt(limit)))
        const skip = (pageNumber - 1) * limitNumber

        const orders = await Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNumber).select("orderNumber customerSnapshot totalAmount orderStatus payment createdAt")

        const total = await Order.countDocuments(query)

        res.status(200).json({
            success: true,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            total,
            orders
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

export const getOrderAdminById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid order ID"})
        }
        const order = await Order.findById(req.params.id)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        res.status(200).json({
            success: true,
            order
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

export const updateOrderStatusAdmin = async (req, res) => {
    try {
        const { status, note } = req.body

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid order ID"})
        }
        const order = await Order.findById(req.params.id)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        if (order.payment.method !== "COD" && order.payment.status !== "Paid") {
            return res.status(400).json({
                message: "Cannot process unpaid order"
            })
        }

        const currentStatus = order.orderStatus

        if (!allowedTransitions[currentStatus].includes(status)) {
            return res.status(400).json({ message: `Cannot change status from ${currentStatus} to ${status}` })
        }

        order.orderStatus = status
        order.statusHistory.push({ status, note })

        if (status === "Shipped") {
            order.tracking.shippedAt = new Date()
        }

        if (status === "Delivered") {
            order.tracking.deliveredAt = new Date()
        }

        await order.save()

        res.status(200).json({
            success: true,
            message: "Order status updated",
            orderStatus: order.orderStatus,
            statusHistory: order.statusHistory
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

export const updateTrackingAdmin = async (req, res) => {
    try {
        const { courier, trackingId, trackingUrl } = req.body

        const order = await Order.findById(req.params.id)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }
        if (courier) order.tracking.courier = courier
        if (trackingId) order.tracking.trackingId = trackingId
        if (trackingUrl) order.tracking.trackingUrl = trackingUrl

        order.tracking = {
            ...order.tracking,
            courier,
            trackingId,
            trackingUrl
        }

        await order.save()

        res.status(200).json({
            success: true,
            message: "Tracking updated"
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

export const cancelOrderAdmin = async (req, res) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const { reason } = req.body

        const order = await Order.findById(req.params.id).session(session)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        if (order.orderStatus === "Cancelled") {
            return res.status(400).json({ message: "Order already cancelled" })
        }

        if (["Shipped", "Delivered"].includes(order.orderStatus)) {
            return res.status(400).json({ message: "Cannot cancel shipped order" })
        }

        // restore stock
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
        order.cancelReason = reason
        order.cancelledAt = new Date()
        order.statusHistory.push({
            status: "Cancelled",
            note: reason
        })

        await order.save({ session })

        await session.commitTransaction()
        session.endSession()

        res.status(200).json({
            success: true,
            message: "Order cancelled and stock restored"
        })
    } catch (err) {
        await session.abortTransaction()
        session.endSession()
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}

export const generateInvoiceAdmin = async (req, res) => {
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
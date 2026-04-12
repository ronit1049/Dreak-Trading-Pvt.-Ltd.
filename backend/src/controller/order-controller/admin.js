import mongoose from "mongoose"
import PDFDocument from "pdfkit"
import Order from "../../schema/order-schema.js"
import Product from "../../schema/product-schema.js"

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
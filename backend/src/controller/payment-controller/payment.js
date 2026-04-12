import razorpay from "../../config/razorpay.js"
import Order from "../../schema/order-schema.js"
import crypto from "node:crypto"

export const createPaymentOrder = async (req, res) => {
    try {
        const { orderId } = req.body

        const order = await Order.findById(orderId)
        if (!order) return res.status(404).json({ message: "Order not found" })

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized" })
        }

        if (order.payment.status === "Paid") {
            return res.status(400).json({ message: "Already paid" })
        }

        const options = {
            amount: Math.round(order.totalAmount * 100), // paise
            currency: 'INR',
            receipt: order.orderNumber
        }

        const razorpayOrder = await razorpay.orders.create(options)

        order.payment.gateway = 'RAZORPAY'
        order.payment.gatewayOrderId = razorpayOrder.id
        order.payment.amount = order.totalAmount
        await order.save()

        res.status(200).json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount: options.amount,
            key: process.env.RAZORPAY_KEY_ID
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body

        const body = razorpay_order_id + '|' + razorpay_payment_id

        const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(body).digest("hex")

        if (expectedSignature !== razorpay_signature) {
            await Order.updateOne(
                {"payment.gatewayOrderId": razorpay_order_id},
                {"payment.status":"Failed"}
            )
            return res.status(400).json({ message: "Payment verification failed" })
        }

        const order = await Order.findOne({
            "payment.gatewayOrderId": razorpay_order_id,
            user: req.user._id
        })

        if (!order) return res.status(404).json({ message: "Order not found" })

        if (order.payment.status === "Paid") {
            return res.json({ success: true })
        }

        // fetch actual method from razorpay
        const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id)
        console.log(razorpayPayment)
        const methodMap = {
            "upi": "UPI",
            "card": "CARD",
            "netbanking": "NET_BANKING",
            "wallet": "WALLET",
            "emi": "CARD"
        }

        order.payment.method = methodMap[razorpayPayment.method] || "CARD"
        order.payment.status = "Paid"
        order.payment.gatewayPaymentId = razorpay_payment_id
        order.payment.gatewaySignature = razorpay_signature
        order.payment.paidAt = new Date()
        order.orderStatus = "Confirmed"

        order.statusHistory.push({ status: "Confirmed" })

        await order.save()

        res.status(200).json({
            success: true,
            message: "Payment verified"
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET

        const signature = req.headers["x-razorpay-signature"]

        const expectedSignature = crypto.createHmac("sha256", secret).update(req.body).digest("hex")

        if (expectedSignature !== signature) {
            return res.status(400).json({ message: "Invalid signature" })
        }

        const event = req.body.event
        if (event === "payment.captured") {
            const payment = req.body.payload.payment.entity

            const order = await Order.findOne({
                "payment.gatewayOrderId": payment.order_id
            })

            if (order && order.payment.status !== "Paid") {
                order.payment.status = "Paid"
                order.payment.gatewayPaymentId = payment.id
                order.payment.paidAt = new Date()
                order.orderStatus = "Confirmed"
                order.statusHistory.push({ status: "Confirmed" })

                await order.save()
            }
        }
        if (event === "payment.failed") {
            const payment = req.body.payload.payment.entity
            await Order.findOneAndUpdate(
                {"payment.gatewayOrderId": payment.order_id},
                {"payment.status": "Failed"}
            )
        }
        res.status(200).send("OK")
    } catch (err) {
        console.error(err)
        res.status(500).send("webhook error")
    }
}

export const getAdminPayments = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query

        const query = {}
        if (status) query["payment.status"] = status

        const skip = (page - 1) * limit

        const [orders, total] = await Promise.all([ 
            Order.find(query).select("orderNumber payment totalAmount user createdAt").skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
            Order.countDocuments(query)
        
        ])

        res.status(200).json({
            success: true,
            payments: orders,
            total,
            page,
            limit
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const refundPayment = async (req, res) => {
    try {
        const { paymentId } = req.params

        const order = await Order.findOne({
            "payment.gatewayPaymentId": paymentId
        })

        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        // check if already refunded
        if (order.payment.status === "Refunded") {
            return res.status(400).json({ message: "Already refunded" })
        }

        // only allow if refund is paid
        if (order.payment.status !== "Paid") {
            return res.status(400).json({ message: "Payment not completed" })
        }

        const refund = await razorpay.payments.refund(paymentId, {
            speed: 'normal'
        })

        order.payment.status = "Refunded"
        order.orderStatus = "Returned"
        order.statusHistory.push({ status: "Returned" })
        await order.save()


        res.status(200).json({
            success: true,
            refund
        })
    } catch (err) {
        console.error("Refund error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}
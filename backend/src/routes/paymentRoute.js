import express from "express"
import { verifyCustomer, verifyAdmin } from "../middleware/authorization.js"
import { createPaymentOrder, verifyPayment, getAdminPayments, refundPayment } from "../controller/payment-controller/payment.js"

const paymentRouter = express.Router()

// public routes
paymentRouter.post("/create-order", verifyCustomer, createPaymentOrder)
paymentRouter.post("/verify-payment", verifyCustomer, verifyPayment)

// private routes
paymentRouter.post("/payment-refunds/:paymentId", verifyAdmin, refundPayment)
paymentRouter.get("/admin-payment-info", verifyAdmin, getAdminPayments)

export default paymentRouter
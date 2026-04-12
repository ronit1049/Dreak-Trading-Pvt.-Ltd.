import express from "express"
import { verifyCustomer, verifyAdmin } from "../middleware/authorization.js"
import { createOrder, getMyOrders, getOrderById, cancelOrder, retryPayment, generateInvoice } from "../controller/order-controller/user.js"
import { getAllOrdersAdmin, getOrderAdminById, updateOrderStatusAdmin, updateTrackingAdmin, cancelOrderAdmin, generateInvoiceAdmin } from "../controller/order-controller/admin.js"

const orderRouter = express.Router()

// public routes
orderRouter.post("/create-order", verifyCustomer, createOrder)
orderRouter.get("/my-orders", verifyCustomer, getMyOrders)
orderRouter.get("/my-order/:id", verifyCustomer, getOrderById)
orderRouter.patch("/cancel-order/:id", verifyCustomer, cancelOrder)
orderRouter.post("/retry-payment/:id", verifyCustomer, retryPayment)
orderRouter.get("/generate-invoice-customer/:id", verifyCustomer, generateInvoice)

// private routes
orderRouter.get("/get-all-orders", verifyAdmin, getAllOrdersAdmin)
orderRouter.get("/get-order/:id", verifyAdmin, getOrderAdminById)
orderRouter.patch("/update-order-status/:id", verifyAdmin, updateOrderStatusAdmin)
orderRouter.get("/generate-invoice/:id", verifyAdmin, generateInvoiceAdmin)
orderRouter.patch("/order-tracking/:id", verifyAdmin, updateTrackingAdmin)
orderRouter.patch("/order-cancel/:id", verifyAdmin, cancelOrderAdmin)

export default orderRouter
import express from "express"
import dotenv from "dotenv"
dotenv.config()
import authRouter from "./routes/authRoute.js"
import categoryRouter from "./routes/categoryRoute.js"
import productRouter from "./routes/productRoute.js"
import orderRouter from "./routes/orderRoute.js"
import paymentRouter from "./routes/paymentRoute.js"
import emailRouter from "./email/email.js"
import cors from "cors"
import cookieParser from "cookie-parser"
import path from "path"
import { razorpayWebhook } from "./controller/payment-controller/payment.js"

const app = express()
app.use(cookieParser())
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}))

// system routes
app.post("/payment-webhook", express.raw({ type: "application/json" }), razorpayWebhook)

app.use(express.json())
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use("/auth", authRouter)
app.use("/category", categoryRouter)
app.use("/product", productRouter)
app.use("/payment", paymentRouter)
app.use("/order", orderRouter)
app.use("/mail", emailRouter)

export default app
import redisClient from "../config/redis.js"
import User from "../schema/user-schema.js"
import jwt from "jsonwebtoken"

export const verifyCustomer = async (req, res, next) => {
    try {
        const token = req.cookies?.token
        if (!token) {
            return res.status(401).json({ message: "You've not logged in" })
        }
        const blacklisted = await redisClient.exists(`TOKEN:${token}`)
        if (blacklisted) {
            return res.status(401).json({ message: "Session expired. Please login again" })
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY)
        if (payload.role !== 'customer') {
            return res.status(401).json({ message: "Access denied" })
        }

        const user = await User.findById(payload._id)
        if (!user || !user.isActive) {
            return res.status(401).json({ message: "Access denied" })
        }

        req.user = user

        next()
    } catch (err) {
        console.log("customer not ok")
        return res.status(401).json({ message: "Invalid or expired token" })
    }
}

export const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.cookies?.token
        if (!token) {
            return res.status(401).json({ message: "Authentication required" })
        }

        const blacklisted = await redisClient.exists(`TOKEN:${token}`)
        if (blacklisted) {
            return res.status(401).json({ message: "Session expired. Please login again" })
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY)
        if (payload.role !== 'admin') {
            return res.status(401).json({ message: "Access denied" })
        }

        const user = await User.findById(payload._id)
        if (!user || !user.isActive) {
            return res.status(401).json({ message: "Access denied" })
        }

        req.user = user

        next()
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" })
    }
}
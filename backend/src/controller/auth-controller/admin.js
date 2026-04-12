import User from "../../schema/user-schema.js"
import validator from "validator"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

export const adminSignUp = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "Required fields missing" })
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" })
        }
        if (!validator.isStrongPassword(password)) {
            return res.status(400).json({ message: "Password is weak" })
        }

        req.body.password = await bcrypt.hash(req.body.password, 10)
        req.body.role = 'admin'

        try {
            const admin = await User.create(req.body)
            const token = jwt.sign({ _id: admin._id, fname: admin.firstName, lname: admin.lastName, email: admin.email, role: admin.role }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' })

            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            res.status(201).json({
                success: true,
                message: "Account created successfully",
                admin: {
                    _id: admin._id,
                    firstName: admin.firstName,
                    email: admin.email
                }
            })
        } catch (err) {
            console.error("MongoDB update error:", err)
            return res.status(500).send("Database error: " + err.message)
        }
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error",
            field: "name"
        })
    }
}
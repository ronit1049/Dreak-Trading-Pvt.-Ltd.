import User from "../../schema/user-schema.js"
import redisClient from "../../config/redis.js"
import validator from "validator"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import crypto from "node:crypto"
import { sendEmail } from "../../email/email.js"

export const customerSignUp = async (req, res) => {
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
        req.body.role = "customer"
        const customer = await User.create(req.body)

        const token = jwt.sign({ _id: customer._id, fname: customer.firstName, lname: customer.lastName, email: customer.email, role: customer.role }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' })

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        res.status(201).json({
            success: true,
            message: "Account created successfully"
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const customerSignIn = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ message: "Required fields missing" })
        }

        const customer = await User.findOne({ email }).select("+password")
        if (!customer) {
            return res.status(404).json({ message: "Invalid credential" })
        }

        const correct_pwd = await bcrypt.compare(password, customer.password)
        if (!correct_pwd) {
            return res.status(404).json({ message: "Invalid credentials" })
        }

        const token = jwt.sign({ _id: customer._id, fname: customer.firstName, lname: customer.lastName, email: customer.email, role: customer.role }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" })

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        res.status(200).json({
            success: true,
            message: "Login successful"
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const customerLogout = async (req, res) => {
    try {
        const { token } = req.cookies
        await redisClient.set(`TOKEN:${token}`, 'BLOCKED')

        const payload = jwt.decode(token)
        await redisClient.expireAt(`TOKEN:${token}`, payload.exp)

        res.cookie('token', null, { expires: new Date(Date.now()) })

        res.status(200).json({
            success: true,
            message: "Logout successful"
        })
    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}

export const forgotPassword = async (req, res) => {
    const { email } = req.body
    try {
        if (!email) {
            return res.status(400).json({ message: "Email is required" })
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.status(200).json({
                message: "If this email exists, a reset link has been sent"
            })
        }

        // generate token
        const resetToken = crypto.randomBytes(32).toString("hex")
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")

        user.resetPasswordToken = hashedToken
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000

        await user.save()

        // frontend reset URL
        const resetURL = `${process.env.CLIENT_URL}/auth/reset?token=${resetToken}`

        // email template
        const html = `
            <h2>Dreak Trading Pvt. Ltd.</h2>

            <p>Reset your password</p>
            <p>Click the button below to reset your password. If you didn't request this, ignore this email.</p>

            <a href="${resetURL}" style="display:inline-block;padding:10px 20px;background: #173054;color:white;text-decoration:none;border-radius:5px;">Reset Your Password</a>
            <p>This link will expire in 15 minutes</p>
        `

        await sendEmail({
            to: user.email,
            subject: "Password Reset Request",
            html
        })

        res.status(200).json({
            success: true,
            message: "If this email exists, a reset link has been sent"
        })
    } catch (err) {
        console.error(err)
        // rollback token if email fails
        const user = await User.findOne({ email })
        user.resetPasswordToken = undefined
        user.resetPasswordExpires = undefined
        await user.save()

        res.status(500).json({ message: "Server error" })
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body
        if (!token || !password || !confirmPassword) {
            return res.status(400).json({ message: "Missing fields" })
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" })
        }

        if (!validator.isStrongPassword(password)) {
            return res.status(400).json({ message: "Weak password" })
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        })

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" })
        }

        // update password
        user.password = await bcrypt.hash(password, 10)

        // clear reset fields
        user.resetPasswordToken = undefined
        user.resetPasswordExpires = undefined

        await user.save()

        // auto login (login after password reset completion)
        const jwtToken = jwt.sign(
            {
                _id: user._id,
                fname: user.firstName,
                lname: user.lastName,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "7d" }
        )

        res.cookie("token", jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        res.status(200).json({
            success: true,
            message: "Password reset successful"
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Server error" })
    }
}

export const checkAuth = async (req, res) => {
    try {
        const token = req.cookies?.token
        if (!token) {
            return res.status(200).json({ isLoggedIn: false })
        }

        const blacklisted = await redisClient.exists(`TOKEN:${token}`)
        if (blacklisted) {
            return res.status(200).json({ isLoggedIn: false })
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY)

        res.status(200).json({
            isLoggedIn: true,
            user: {
                id: payload._id,
                email: payload.email,
                role: payload.role
            }
        })
    } catch (err) {
        return res.status(200).json({ isLoggedIn: false })
    }
}

export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?._id
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access"
            })
        }

        const user = await User.findById(userId).select("firstName lastName email role phone addresses createdAt isActive").lean()
        console.log(user)
        console.log(user.isActive)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Account is deactivated"
            })
        }

        res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: user
        })

    } catch (err) {
        console.error("Error: " + err)
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Server error"
        })
    }
}


/*-------No need of account delete functionality for now-------*/

// export const accountDelete = async (req, res) => {
//     try {
//         const userId = req.user._id
//         await User.findByIdAndUpdate(userId, {
//             isActive: false
//         })

//         res.clearCookie("token")
//         res.status(200).json({
//             success: true,
//             message: "Account deactivated"
//         })
//     } catch (err) {
//         console.error("Error: " + err)
//         res.status(err.statusCode || 500).json({
//             success: false,
//             message: err.message || "Server error"
//         })
//     }
// }
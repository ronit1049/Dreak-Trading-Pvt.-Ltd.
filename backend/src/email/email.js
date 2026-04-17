import nodemailer from "nodemailer"
import express from "express"

const emailRouter = express.Router()

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})
transporter.verify((error, success) => {
    if(error) {
        console.log("Email config error:", error)
    } else {
        console.log("Email server is ready")
    }
})

export const sendEmail =  async ({ to, subject, html }) => {
    try {
        await transporter.sendMail({
            from: `"Liventra Furniture & Decor" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        })
    } catch (err) {
        console.error("Email sending error:", err)
        throw new Error("Email could not be send")
    }
}

emailRouter.post("/serviceEmail", async (req, res) => {
    const { fullName, emailAddress, phoneNumber, service, requirement } = req.body
    if (!fullName || !emailAddress || !phoneNumber || !service || !requirement) {
        return res.status(400).json({ message: "All fields are required" })
    }

    try {
        await transporter.sendMail({
            from: `"${fullName}" <${emailAddress}`,
            to: process.env.EMAIL_USER,
            subject: `${service}`,
            html: `
                <h3>Service related to ${service} for ${fullName} from Liventra Furniture & Decor</h3>

                <p>Requirement message: ${requirement}</p>
            `
        })
        res.status(200).json({ message: "Email sent successfully" })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to send email" })
    }
})

emailRouter.post("/contactEmail", async (req, res) => {
    const { name, email, message } = req.body
    if (!name || !email || !message) {
        return res.status(400).json({message: "Required fields missing"})
    }

    try {
        await transporter.sendMail({
            from: `"${name}" <${email}>`,
            to: process.env.EMAIL_USER,
            subject: "Contacting with Liventra Furniture & Decor",
            html: `
                <h3>Messge to Liventra Furniture & Decor from ${name}</h3>

                <p>Message from customer: ${message}</p>
            `
        })
        res.status(200).json({ message: "Email sent successfully" })
    } catch (err) {
        console.error(err)
        res.status(500).json({message: "Failed to send email"})
    }
})

export default emailRouter
import nodemailer from "nodemailer"

console.log("EMAIL_USER in email.js:", process.env.EMAIL_USER)
console.log("EMAIL_PASS in email.js:", process.env.EMAIL_PASS ? "Loaded" : "Missing")


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
            from: `"Furniture Shop" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        })
    } catch (err) {
        console.error("Email sending error:", err)
        throw new Error("Email could not be send")
    }
}
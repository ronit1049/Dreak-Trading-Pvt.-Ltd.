import express from "express"
import { customerSignUp, customerSignIn, customerLogout, resetPassword, forgotPassword, checkAuth, getMyProfile } from "../controller/auth-controller/user.js"
import { adminSignUp } from "../controller/auth-controller/admin.js"
import { verifyAdmin, verifyCustomer } from "../middleware/authorization.js"

const authRouter = express.Router()

// public routes
authRouter.post("/sign-up", customerSignUp)
authRouter.post("/sign-in", customerSignIn)
authRouter.post("/sign-out", customerLogout)
authRouter.post("/recover", forgotPassword)
authRouter.post("/reset", resetPassword)
authRouter.get("/me", checkAuth)
authRouter.get("/my-profile", verifyCustomer, getMyProfile)

// admin routes
authRouter.post("/admin-sign-up", verifyAdmin, adminSignUp)

export default authRouter
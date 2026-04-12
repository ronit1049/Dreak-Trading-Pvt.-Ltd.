import { BASE_URL } from "../config.js"

// SIGNUP
async function signup() {
    const firstName = document.getElementById("firstName").value.trim()
    const lastName = document.getElementById("lastName").value.trim()
    const email = document.getElementById("email").value.trim()
    const password = document.getElementById("password").value
    const confirmPassword = document.getElementById("confirmPassword").value

    // validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        alert("All fields are required")
        return
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match")
        return
    }

    try {
        const res = await fetch(`${BASE_URL}/sign-up`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ firstName, lastName, email, password })
        })

        const data = await res.json()

        if (res.ok) {
            alert("Signup successful!")
            window.location.href = "/signin"
        } else {
            alert(data.message)
        }

    } catch (err) {
        console.error(err)
        alert("Something went wrong")
    }
}

// SIGNIN
async function signin() {
    const email = document.getElementById("loginEmail").value.trim()
    const password = document.getElementById("loginPassword").value

    if (!email || !password) {
        alert("All fields are required")
        return
    }

    try {
        const res = await fetch(`${BASE_URL}/sign-in`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password })
        })

        const data = await res.json()

        if (res.ok) {
            alert("Login successful!")
            window.location.href = "/" // your home page
        } else {
            alert(data.message)
        }

    } catch (err) {
        console.error(err)
        alert("Something went wrong")
    }
}

// RECOVER PASSWORD
async function recoverPassword() {
    const email = document.getElementById("recoverEmail").value.trim()
    const msg = document.getElementById("recoverMsg")

    if (!email) {
        alert("Please enter your email")
        return
    }

    try {
        const res = await fetch(`${BASE_URL}/recover`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        })

        const data = await res.json()

        if (res.ok) {
            msg.style.display = "block"
        } else {
            alert(data.message)
        }

    } catch (err) {
        console.error(err)
        alert("Something went wrong")
    }
}

// RESET PASSWORD
async function resetPassword() {
    const password = document.getElementById("newPassword").value
    const confirmPassword = document.getElementById("confirmNewPassword").value

    if (!password || !confirmPassword) {
        alert("All fields are required")
        return
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match")
        return
    }

    // extract token from URL
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")

    if (!token) {
        console.log("hello")
        alert("Invalid or missing token")
        return
    }

    try {
        const res = await fetch(`${BASE_URL}/reset`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ token, password, confirmPassword })
        })

        const data = await res.json()

        if (res.ok) {
            alert("Password reset successful!")
            window.location.href = "/" // home page
        } else {
            alert(data.message)
        }

    } catch (err) {
        console.error(err)
        alert("Something went wrong")
    }
}
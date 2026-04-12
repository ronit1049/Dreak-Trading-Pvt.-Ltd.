import main from "./config/mongoose.js"
import app from "./app.js"
import redisClient from "./config/redis.js"

const PORT = process.env.PORT
const initialize_db_connection = async() => {
    try {
        await Promise.all([redisClient.connect(), main()])
        console.log("Connected to database")
        app.listen(PORT, () => {
            console.log(`Server started at port number: ${PORT}`)
        })
    } catch(err) {
        console.error("Error: " + err)
    }
}

initialize_db_connection()
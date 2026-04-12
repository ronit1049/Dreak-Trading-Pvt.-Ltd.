import dotenv from "dotenv"
dotenv.config()
import { createClient } from "redis"

const redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASSKEY,
    socket: {
        host: 'redis-17822.crce217.ap-south-1-1.ec2.cloud.redislabs.com',
        port: 17822
    }
})
export default redisClient
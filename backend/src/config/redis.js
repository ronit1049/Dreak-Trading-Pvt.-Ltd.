import dotenv from "dotenv"
dotenv.config()
import { createClient } from "redis"

const redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASSKEY,
    socket: {
        host: 'redis-16476.crce276.ap-south-1-3.ec2.cloud.redislabs.com',
        port: 16476

    }
})
export default redisClient
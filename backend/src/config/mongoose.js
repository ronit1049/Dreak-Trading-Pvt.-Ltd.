import mongoose from "mongoose"

async function main() {
    await mongoose.connect(process.env.DB_STRING)
}

export default main
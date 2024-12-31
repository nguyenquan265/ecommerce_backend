import mongoose from 'mongoose'

const connectEcommerceDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI_ECOMMERCE as string)

    console.log(`MongoDB Connected`)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

export default connectEcommerceDB

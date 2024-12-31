import { Schema, Document, model, Types, models } from 'mongoose'

interface IProduct extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  description: string
  categories: string[]
  supplier: string
  content: string
  expiredDate: Date
  images: string[]
  isDeleted: boolean
}

const productSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: true
    },
    slug: String,
    description: String,
    categories: [String],
    supplier: {
      require: true,
      type: String
    },
    content: String,
    expiredDate: Date,
    images: [String],
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

const Product = models.Product || model<IProduct>('Product', productSchema)

export default Product

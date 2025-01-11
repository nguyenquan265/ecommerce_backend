import { Schema, Document, model, Types, models } from 'mongoose'

interface IProduct extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  description: string
  categories: {
    _id: string
    name: string
    slug: string
  }[]
  price: number
  priceDiscount: number
  quantity: number
  mainImage: string
  subImages: string[]
  isDeleted: boolean
}

const productSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      unique: true
    },
    description: String,
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category'
      }
    ],
    price: {
      type: Number,
      required: true
    },
    priceDiscount: {
      type: Number,
      default: 0
    },
    quantity: {
      type: Number,
      default: 0
    },
    mainImage: String,
    subImages: [String],
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

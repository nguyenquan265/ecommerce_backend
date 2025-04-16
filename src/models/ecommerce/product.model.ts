import { Schema, Document, model, Types, models } from 'mongoose'

export interface IProduct extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  description: string
  category: Types.ObjectId
  size: string
  price: number
  priceDiscount: number
  quantity: number
  quantitySold: number
  mainImage: string
  subImages: {
    url: string
  }[]
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
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category'
    },
    size: String,
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
      default: 10
    },
    quantitySold: {
      type: Number,
      default: 0
    },
    mainImage: String,
    subImages: [
      {
        url: String
      }
    ],
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

import { Schema, Document, model, Types, models } from 'mongoose'

interface IProduct extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  description: string
  categories: string[]
  price: number
  priceDiscount: number
  quantity: number
  mainImage: string
  images: string[]
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
    categories: [String],
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

productSchema.pre('save', function (next) {
  if (!this.isModified('title')) return next()

  this.slug = this.title
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')

  next()
})

const Product = models.Product || model<IProduct>('Product', productSchema)

export default Product

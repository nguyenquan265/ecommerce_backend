import { Schema, Document, model, Types, models } from 'mongoose'

export interface ICategory extends Document {
  _id: Types.ObjectId
  name: string
  slug: string
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      unique: true
    }
  },
  {
    timestamps: true
  }
)

const Category = models.Category || model<ICategory>('Category', categorySchema)

export default Category

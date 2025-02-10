import { Schema, Document, model, Types, models } from 'mongoose'

export interface ICart extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  cartItems: {
    product: Types.ObjectId
    quantity: number
  }[]
  totalQuantity: number
}

const cartSchema = new Schema<ICart>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    cartItems: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        quantity: {
          type: Number,
          required: true
        }
      }
    ],
    totalQuantity: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
)

const Cart = models.Cart || model<ICart>('Cart', cartSchema)

export default Cart

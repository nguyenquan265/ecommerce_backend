import { Schema, Document, model, Types, models } from 'mongoose'

export interface IOrder extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  orderItems: {
    product: Types.ObjectId
    title: string
    size: string
    amount: number
    image: string
    price: number
  }[]
  shippingAddress: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    district: string
    ward: string
    cityName: string
    districtName: string
    wardName: string
  }
  paymentMethod: string
  shippingFee: number
  totalPrice: number
  isPaid: boolean
  paidAt: Date
  isDelivered: boolean
  deliveredAt: Date
  status: string
}

const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    orderItems: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        title: { type: String, required: true },
        size: { type: String, required: true },
        amount: { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true }
      }
    ],
    shippingAddress: {
      name: String,
      email: String,
      phone: String,
      address: String,
      province: String,
      provinceName: String,
      district: String,
      districtName: String,
      ward: String,
      wardName: String
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['COD', 'ZALO', 'MOMO', 'PAYOS']
    },
    shippingFee: {
      type: Number,
      required: true,
      default: 3000
    },
    totalPrice: {
      type: Number,
      required: true
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false
    },
    paidAt: Date,
    isDelivered: {
      type: Boolean,
      required: true,
      default: false
    },
    deliveredAt: Date,
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Processing', 'Delivering', 'Delivered', 'Cancelled'],
      default: 'Pending'
    }
  },
  {
    timestamps: true
  }
)

const Order = models.Order || model<IOrder>('Order', orderSchema)

export default Order

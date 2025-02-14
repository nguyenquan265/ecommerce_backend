import { Schema, Document, model, Types, models } from 'mongoose'

interface IUser extends Document {
  _id: Types.ObjectId
  name: string
  email: string
  password?: string
  phoneNumber?: string
  photoUrl: string
  shippingAddress?: {
    address: string
    city: string
    district: string
    ward: string
    cityName: string
    districtName: string
    wardName: string
  }
  wishlistItems: Types.ObjectId[]
  isGoogleAccount: boolean
  isActive: boolean
  isAdmin: boolean
  resetPasswordToken?: string
  resetPasswordExpiresAt?: Date
  verificationToken?: string
  verificationTokenExpiresAt?: Date
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      min: 6,
      max: 20
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (v: string) {
          return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)
        },
        message: (props) => `${props.value} is not a valid email!`
      }
    },
    password: {
      type: String,
      select: false
    },
    phoneNumber: {
      type: String
    },
    photoUrl: {
      type: String,
      default: 'https://png.pngtree.com/png-clipart/20210129/ourmid/pngtree-default-male-avatar-png-image_2811083.jpg'
    },
    shippingAddress: {
      address: String,
      province: String,
      provinceName: String,
      district: String,
      districtName: String,
      ward: String,
      wardName: String
    },
    wishlistItems: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product'
      }
    ],
    isGoogleAccount: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
    verificationToken: String,
    verificationTokenExpiresAt: Date
  },
  {
    timestamps: true
  }
)

const User = models.User || model<IUser>('User', userSchema)

export default User

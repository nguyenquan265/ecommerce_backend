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
  isGoogleAccount: boolean
  isActive: boolean
  isAdmin: boolean
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
      type: String,
      validate: {
        validator: function (v: string) {
          return /(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(v)
        },
        message: (props) => `${props.value} is not a valid phone number!`
      }
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
    }
  },
  {
    timestamps: true
  }
)

const User = models.User || model<IUser>('User', userSchema)

export default User

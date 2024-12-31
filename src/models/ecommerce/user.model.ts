import { Schema, Document, model, Types, models } from 'mongoose'

interface IUser extends Document {
  _id: Types.ObjectId
  name: string
  firstName?: string
  lastName?: string
  email: string
  password?: string
  phoneNumber?: string
  photoUrl?: string
  rule: number
  address?: string
  isGoogleAccount: boolean
  isActive: boolean
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
    firstName: String,
    lastName: String,
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
    phoneNumber: String,
    photoUrl: String,
    rule: {
      type: Number,
      default: 1
    },
    address: String,
    isGoogleAccount: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
)

const User = models.User || model<IUser>('User', userSchema)

export default User

import { Schema, model, Document, Types } from 'mongoose';
import { ALL_ROLES, ROLES, Role } from '../constants/roles';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: Role;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.USER,
      required: true,
    },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);

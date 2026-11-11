import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  details?: string;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    details: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      default: 'pcs',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Product = mongoose.model<IProduct>('Product', ProductSchema);


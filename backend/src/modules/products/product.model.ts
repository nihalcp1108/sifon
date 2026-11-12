import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  code?: string;
  name: string;
  brandId?: mongoose.Types.ObjectId | any;
  categoryId?: mongoose.Types.ObjectId | any;
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
      trim: true,
      uppercase: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Product = mongoose.model<IProduct>('Product', ProductSchema);

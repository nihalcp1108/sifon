import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
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

// Compound case-insensitive unique index for category names
CategorySchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
  }
);

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

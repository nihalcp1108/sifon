import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryBalance extends Document {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  areaId: mongoose.Types.ObjectId;
  availableQuantity: number;
  damagedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryBalanceSchema = new Schema<IInventoryBalance>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    areaId: {
      type: Schema.Types.ObjectId,
      ref: 'Area',
      required: true,
      index: true,
    },
    availableQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Available quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
    damagedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Damaged quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
  },
  {
    timestamps: true,
  }
);

InventoryBalanceSchema.index({ productId: 1, areaId: 1 }, { unique: true });

export const InventoryBalance = mongoose.model<IInventoryBalance>(
  'InventoryBalance',
  InventoryBalanceSchema
);


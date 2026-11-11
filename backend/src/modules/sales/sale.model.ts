import mongoose, { Schema, Document } from 'mongoose';

export interface ISaleItem {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  sourceAreaId: mongoose.Types.ObjectId;
  quantity: number;
  returnedQuantity: number;
}

export type SaleStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface ISale extends Document {
  _id: mongoose.Types.ObjectId;
  reference: string;
  saleDate: Date;
  items: ISaleItem[];
  notes?: string;
  status: SaleStatus;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sourceAreaId: {
      type: Schema.Types.ObjectId,
      ref: 'Area',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
    returnedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Returned quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
  },
  { _id: true }
);

const SaleSchema = new Schema<ISale>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    saleDate: {
      type: Date,
      required: true,
      index: true,
    },
    items: {
      type: [SaleItemSchema],
      required: true,
      validate: {
        validator: (v: any[]) => Array.isArray(v) && v.length > 0,
        message: 'A sale must have at least one line item',
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'POSTED', 'CANCELLED'],
      default: 'POSTED',
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    postedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Sale = mongoose.model<ISale>('Sale', SaleSchema);


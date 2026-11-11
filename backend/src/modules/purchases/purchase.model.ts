import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseItem {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  receivingAreaId: mongoose.Types.ObjectId;
  quantity: number;
}

export type PurchaseStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface IPurchase extends Document {
  _id: mongoose.Types.ObjectId;
  reference: string;
  purchaseDate: Date;
  items: IPurchaseItem[];
  notes?: string;
  status: PurchaseStatus;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    receivingAreaId: {
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
  },
  { _id: true }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      index: true,
    },
    items: {
      type: [PurchaseItemSchema],
      required: true,
      validate: {
        validator: (v: any[]) => Array.isArray(v) && v.length > 0,
        message: 'A purchase must have at least one line item',
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

export const Purchase = mongoose.model<IPurchase>('Purchase', PurchaseSchema);


import mongoose, { Schema, Document } from 'mongoose';

export type MovementType =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'PURCHASE_REVERSAL'
  | 'SALE'
  | 'SALE_REVERSAL'
  | 'RETURN_AVAILABLE'
  | 'RETURN_DAMAGED'
  | 'RETURN_REVERSAL_AVAILABLE'
  | 'RETURN_REVERSAL_DAMAGED';

export type SourceDocumentType = 'OPENING' | 'PURCHASE' | 'SALE' | 'RETURN';

export interface IInventoryMovement extends Document {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  areaId: mongoose.Types.ObjectId;
  availableDelta: number;
  damagedDelta: number;
  movementType: MovementType;
  sourceDocumentType: SourceDocumentType;
  sourceDocumentId: mongoose.Types.ObjectId;
  sourceDocumentLineId?: mongoose.Types.ObjectId;
  originalMovementId?: mongoose.Types.ObjectId;
  businessDate: Date;
  createdBy: mongoose.Types.ObjectId;
  reason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
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
    availableDelta: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
    damagedDelta: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
    movementType: {
      type: String,
      required: true,
      enum: [
        'OPENING_STOCK',
        'PURCHASE',
        'PURCHASE_REVERSAL',
        'SALE',
        'SALE_REVERSAL',
        'RETURN_AVAILABLE',
        'RETURN_DAMAGED',
        'RETURN_REVERSAL_AVAILABLE',
        'RETURN_REVERSAL_DAMAGED',
      ],
      index: true,
    },
    sourceDocumentType: {
      type: String,
      required: true,
      enum: ['OPENING', 'PURCHASE', 'SALE', 'RETURN'],
      index: true,
    },
    sourceDocumentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sourceDocumentLineId: {
      type: Schema.Types.ObjectId,
    },
    originalMovementId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryMovement',
    },
    businessDate: {
      type: Date,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

InventoryMovementSchema.index({ businessDate: 1, productId: 1, areaId: 1 });

export const InventoryMovement = mongoose.model<IInventoryMovement>(
  'InventoryMovement',
  InventoryMovementSchema
);


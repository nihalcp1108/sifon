import mongoose, { Schema, Document } from 'mongoose';

export type ReturnStatus = 'POSTED' | 'CANCELLED';

export interface IReturn extends Document {
  _id: mongoose.Types.ObjectId;
  reference: string;
  returnDate: Date;
  saleId: mongoose.Types.ObjectId;
  saleLineId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  receivingAreaId: mongoose.Types.ObjectId;
  nonDamagedQuantity: number;
  damagedQuantity: number;
  reason: string;
  status: ReturnStatus;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnSchema = new Schema<IReturn>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    returnDate: {
      type: Date,
      required: true,
      index: true,
    },
    saleId: {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },
    saleLineId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    receivingAreaId: {
      type: Schema.Types.ObjectId,
      ref: 'Area',
      required: true,
      index: true,
    },
    nonDamagedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Non-damaged quantity cannot be negative'],
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
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['POSTED', 'CANCELLED'],
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
  },
  {
    timestamps: true,
  }
);

ReturnSchema.pre('validate', function (next) {
  if (this.nonDamagedQuantity <= 0 && this.damagedQuantity <= 0) {
    next(new Error('At least one of non-damaged or damaged quantity must be greater than zero'));
  } else {
    next();
  }
});

export const Return = mongoose.model<IReturn>('Return', ReturnSchema);


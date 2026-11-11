import mongoose, { Schema, Document } from 'mongoose';

export interface IArea extends Document {
  _id: mongoose.Types.ObjectId;
  areaNumber: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AreaSchema = new Schema<IArea>(
  {
    areaNumber: {
      type: Number,
      required: true,
      unique: true,
      min: [1, 'Area number must be a positive integer'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value',
      },
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AreaSchema.virtual('displayName').get(function (this: IArea) {
  return `Area ${this.areaNumber}`;
});

export const Area = mongoose.model<IArea>('Area', AreaSchema);


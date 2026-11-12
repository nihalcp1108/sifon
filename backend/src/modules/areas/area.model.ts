import mongoose, { Schema, Document } from 'mongoose';

export interface IArea extends Document {
  _id: mongoose.Types.ObjectId;
  name?: string;
  sectionId?: mongoose.Types.ObjectId | any;
  areaNumber?: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  displayName?: string;
}

const AreaSchema = new Schema<IArea>(
  {
    name: {
      type: String,
      trim: true,
      index: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      index: true,
    },
    areaNumber: {
      type: Number,
      sparse: true,
      index: true,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AreaSchema.virtual('displayName').get(function (this: any) {
  const areaName = this.name || (this.areaNumber ? `Area ${this.areaNumber}` : 'Unnamed Area');
  if (this.sectionId && typeof this.sectionId === 'object' && this.sectionId.name) {
    return `${this.sectionId.name} — ${areaName}`;
  }
  return areaName;
});

export const Area = mongoose.model<IArea>('Area', AreaSchema);

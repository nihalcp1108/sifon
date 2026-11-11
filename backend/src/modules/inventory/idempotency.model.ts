import mongoose, { Schema, Document } from 'mongoose';

export interface IIdempotencyRecord extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  endpoint: string;
  requestHash: string;
  statusCode: number;
  responseBody: any;
  createdAt: Date;
  updatedAt: Date;
}

const IdempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    responseBody: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const IdempotencyRecord = mongoose.model<IIdempotencyRecord>(
  'IdempotencyRecord',
  IdempotencyRecordSchema
);


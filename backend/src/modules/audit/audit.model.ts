import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  entityType: 'PURCHASE' | 'SALE' | 'RETURN' | 'PRODUCT' | 'AREA' | 'AUTH';
  entityId: mongoose.Types.ObjectId | string;
  action: string;
  performedBy?: mongoose.Types.ObjectId;
  details?: any;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    details: {
      type: Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);


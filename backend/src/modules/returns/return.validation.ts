import { z } from 'zod';

const optionalReferenceSchema = z
  .string()
  .max(50, 'Reference cannot exceed 50 characters')
  .optional()
  .nullable()
  .transform(val => {
    if (!val) return undefined;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

export const createReturnSchema = z
  .object({
    reference: optionalReferenceSchema,
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    productId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format').optional(),
    receivingAreaId: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Location ID format')
      .optional()
      .nullable()
      .transform(val => (val && val.length > 0 ? val : undefined)),
    quantity: z.coerce
      .number({ invalid_type_error: 'Quantity must be a valid number' })
      .int('Quantity must be an integer')
      .positive('Quantity must be greater than zero')
      .optional(),
    condition: z.enum(['USABLE', 'DAMAGED', 'Usable', 'Damaged']).optional(),
    notes: z.string().trim().max(1000).optional(),
    saleId: z.string().trim().optional(),
    saleLineId: z.string().trim().optional(),
    nonDamagedQuantity: z.coerce
      .number({ invalid_type_error: 'Non-damaged quantity must be a valid number' })
      .int('Non-damaged quantity must be an integer')
      .min(0, 'Non-damaged quantity cannot be negative')
      .default(0),
    damagedQuantity: z.coerce
      .number({ invalid_type_error: 'Damaged quantity must be a valid number' })
      .int('Damaged quantity must be an integer')
      .min(0, 'Damaged quantity cannot be negative')
      .default(0),
    reason: z.string().trim().max(500).optional(),
  })
  .refine(
    data => {
      if (data.productId) {
        return Boolean(data.quantity && data.quantity > 0 && data.receivingAreaId);
      }
      if (data.saleId && data.saleLineId) {
        return data.nonDamagedQuantity > 0 || data.damagedQuantity > 0 || (data.quantity && data.quantity > 0);
      }
      return false;
    },
    {
      message: 'Please provide Product, Location, and Quantity',
      path: ['productId'],
    }
  );

export const cancelReturnSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required (min 3 chars)').max(500),
});

export const returnQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  productId: z.string().optional(),
  areaId: z.string().optional(),
  saleId: z.string().optional(),
  status: z.enum(['POSTED', 'CANCELLED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type CancelReturnInput = z.infer<typeof cancelReturnSchema>;
export type ReturnQueryInput = z.infer<typeof returnQuerySchema>;


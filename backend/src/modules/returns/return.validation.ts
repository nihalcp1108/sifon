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
    saleId: z.string().trim().min(1, 'Sale ID is required'),
    saleLineId: z.string().trim().min(1, 'Sale line item ID is required'),
    receivingAreaId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(val => (val && val.length > 0 ? val : undefined)),
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
    reason: z.string().trim().min(3, 'Reason is required (min 3 chars)').max(500),
  })
  .refine(data => data.nonDamagedQuantity > 0 || data.damagedQuantity > 0, {
    message: 'At least one of non-damaged or damaged quantity must be greater than zero',
    path: ['nonDamagedQuantity'],
  });

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


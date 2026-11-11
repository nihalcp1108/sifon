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

const optionalNotesSchema = z
  .string()
  .max(1000, 'Notes cannot exceed 1000 characters')
  .optional()
  .nullable()
  .transform(val => {
    if (!val) return undefined;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const saleItemSchema = z.object({
  productId: z
    .string({ required_error: 'Product is required' })
    .trim()
    .min(1, 'Product is required'),
  sourceAreaId: z
    .string({ required_error: 'Source area is required' })
    .trim()
    .min(1, 'Source area is required'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a valid number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0'),
});

export const createSaleSchema = z.object({
  reference: optionalReferenceSchema,
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  items: z.array(saleItemSchema).min(1, 'At least one line item is required'),
  notes: optionalNotesSchema,
  isDraft: z.boolean().optional().default(false),
});

export const updateSaleDraftSchema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  items: z.array(saleItemSchema).min(1, 'At least one line item is required').optional(),
  notes: optionalNotesSchema,
});

export const cancelSaleSchema = z.object({
  reason: z.string().trim().min(3, 'A cancellation reason is required (min 3 chars)').max(500),
});

export const saleQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
  productId: z.string().optional(),
  areaId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleDraftInput = z.infer<typeof updateSaleDraftSchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
export type SaleQueryInput = z.infer<typeof saleQuerySchema>;


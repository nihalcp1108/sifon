import { z } from 'zod';
import {
  booleanQueryParam,
  positiveIntQueryParam,
  optionalObjectIdQueryParam,
} from '../../utils/query-validation.js';

export const createBrandSchema = z.object({
  name: z.string({ required_error: 'Brand name is required' }).trim().min(1, 'Brand name cannot be empty').max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name cannot be empty').max(100).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const brandQuerySchema = z.object({
  page: positiveIntQueryParam(1),
  limit: positiveIntQueryParam(50, 1000),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  search: z.string().trim().optional(),
});

export const brandOptionsQuerySchema = z.object({
  limit: positiveIntQueryParam(100, 500),
  page: positiveIntQueryParam(1),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  selectedId: optionalObjectIdQueryParam,
  search: z.string().trim().optional(),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type BrandQueryInput = z.infer<typeof brandQuerySchema>;
export type BrandOptionsQueryInput = z.infer<typeof brandOptionsQuerySchema>;

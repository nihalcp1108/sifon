import { z } from 'zod';
import {
  booleanQueryParam,
  positiveIntQueryParam,
  optionalObjectIdQueryParam,
} from '../../utils/query-validation.js';

export const createCategorySchema = z.object({
  name: z.string({ required_error: 'Category name is required' }).trim().min(1, 'Category name cannot be empty').max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name cannot be empty').max(100).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const categoryQuerySchema = z.object({
  page: positiveIntQueryParam(1),
  limit: positiveIntQueryParam(50, 1000),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  search: z.string().trim().optional(),
});

export const categoryOptionsQuerySchema = z.object({
  limit: positiveIntQueryParam(100, 500),
  page: positiveIntQueryParam(1),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  selectedId: optionalObjectIdQueryParam,
  search: z.string().trim().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type CategoryOptionsQueryInput = z.infer<typeof categoryOptionsQuerySchema>;

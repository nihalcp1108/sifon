import { z } from 'zod';
import {
  booleanQueryParam,
  positiveIntQueryParam,
  searchQueryParam,
  optionalObjectIdQueryParam,
} from '../../utils/query-validation.js';

export const createProductSchema = z.object({
  code: z
    .string({ required_error: 'Product code/SKU is required' })
    .trim()
    .min(1, 'Product code cannot be empty')
    .max(50, 'Product code must be 50 characters or less')
    .toUpperCase(),
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(1, 'Product name cannot be empty')
    .max(200),
  details: z.string().trim().max(1000).optional(),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  openingStock: z
    .array(
      z.object({
        areaId: z.string().min(1, 'Area ID is required'),
        quantity: z.number().int().positive('Opening quantity must be a positive integer'),
      })
    )
    .optional(),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  details: z.string().trim().max(1000).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  page: positiveIntQueryParam(1),
  limit: positiveIntQueryParam(20, 1000),
  search: searchQueryParam(200),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
});

export const productOptionsQuerySchema = z.object({
  search: searchQueryParam(200),
  limit: positiveIntQueryParam(100, 500),
  page: positiveIntQueryParam(1),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  selectedId: optionalObjectIdQueryParam,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductOptionsQueryInput = z.infer<typeof productOptionsQuerySchema>;



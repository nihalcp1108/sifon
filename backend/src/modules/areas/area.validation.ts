import { z } from 'zod';
import {
  booleanQueryParam,
  positiveIntQueryParam,
  optionalObjectIdQueryParam,
} from '../../utils/query-validation.js';

export const createAreaSchema = z.object({
  name: z.string({ required_error: 'Area name is required' }).trim().min(1, 'Area name cannot be empty').max(100),
  sectionId: z
    .string({ required_error: 'Section is required' })
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Section ID format'),
  description: z.string().trim().max(500).optional(),
  areaNumber: z.number().int().positive().optional(),
});

export const updateAreaSchema = z.object({
  name: z.string().trim().min(1, 'Area name cannot be empty').max(100).optional(),
  sectionId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Section ID format')
    .optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const areaQuerySchema = z.object({
  page: positiveIntQueryParam(1),
  limit: positiveIntQueryParam(50, 1000),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  search: z.string().trim().optional(),
  sectionId: optionalObjectIdQueryParam,
});

export const areaOptionsQuerySchema = z.object({
  limit: positiveIntQueryParam(100, 500),
  page: positiveIntQueryParam(1),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  selectedId: optionalObjectIdQueryParam,
  search: z.string().trim().optional(),
  sectionId: optionalObjectIdQueryParam,
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type AreaQueryInput = z.infer<typeof areaQuerySchema>;
export type AreaOptionsQueryInput = z.infer<typeof areaOptionsQuerySchema>;

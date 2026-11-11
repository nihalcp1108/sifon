import { z } from 'zod';
import {
  booleanQueryParam,
  positiveIntQueryParam,
  optionalObjectIdQueryParam,
} from '../../utils/query-validation.js';

export const createAreaSchema = z.object({
  areaNumber: z
    .number({ required_error: 'Area number is required' })
    .int('Area number must be an integer')
    .positive('Area number must be a positive integer'),
  description: z.string().trim().max(500).optional(),
});

export const updateAreaSchema = z.object({
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const areaQuerySchema = z.object({
  page: positiveIntQueryParam(1),
  limit: positiveIntQueryParam(50, 1000),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
});

export const areaOptionsQuerySchema = z.object({
  limit: positiveIntQueryParam(100, 500),
  page: positiveIntQueryParam(1),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  selectedId: optionalObjectIdQueryParam,
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type AreaQueryInput = z.infer<typeof areaQuerySchema>;
export type AreaOptionsQueryInput = z.infer<typeof areaOptionsQuerySchema>;



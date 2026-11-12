import { z } from 'zod';
import {
  booleanQueryParam,
  positiveIntQueryParam,
  optionalObjectIdQueryParam,
} from '../../utils/query-validation.js';

export const createSectionSchema = z.object({
  name: z.string({ required_error: 'Section name is required' }).trim().min(1, 'Section name cannot be empty').max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateSectionSchema = z.object({
  name: z.string().trim().min(1, 'Section name cannot be empty').max(100).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const sectionQuerySchema = z.object({
  page: positiveIntQueryParam(1),
  limit: positiveIntQueryParam(50, 1000),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  search: z.string().trim().optional(),
});

export const sectionOptionsQuerySchema = z.object({
  limit: positiveIntQueryParam(100, 500),
  page: positiveIntQueryParam(1),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  selectedId: optionalObjectIdQueryParam,
  search: z.string().trim().optional(),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type SectionQueryInput = z.infer<typeof sectionQuerySchema>;
export type SectionOptionsQueryInput = z.infer<typeof sectionOptionsQuerySchema>;

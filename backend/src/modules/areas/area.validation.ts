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

// Preprocessor for sectionId filter query parameter: accepts 24-hex ObjectId, 'unassigned', or undefined
export const sectionFilterQueryParam = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    const clean = val.trim();
    if (clean === '' || clean === 'undefined' || clean === 'null' || clean === 'all') return undefined;
    if (clean.toLowerCase() === 'unassigned') return 'unassigned';
    return clean;
  }
  return val;
}, z.union([z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Section ID format'), z.literal('unassigned')]).optional());

export const areaQuerySchema = z.object({
  page: positiveIntQueryParam(1),
  limit: positiveIntQueryParam(25, 1000),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  search: z.string().trim().optional(),
  sectionId: sectionFilterQueryParam,
});

export const areaOptionsQuerySchema = z.object({
  limit: positiveIntQueryParam(100, 500),
  page: positiveIntQueryParam(1),
  activeOnly: booleanQueryParam,
  isActive: booleanQueryParam,
  selectedId: optionalObjectIdQueryParam,
  search: z.string().trim().optional(),
  sectionId: sectionFilterQueryParam,
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type AreaQueryInput = z.infer<typeof areaQuerySchema>;
export type AreaOptionsQueryInput = z.infer<typeof areaOptionsQuerySchema>;

import { z } from 'zod';

/**
 * Robust query parameter parser for booleans.
 * Correctly distinguishes:
 * - 'true', '1', 1, true -> true
 * - 'false', '0', 0, false -> false
 * - '', 'undefined', 'null', 'all', undefined, null -> undefined (omitted)
 * - invalid values (e.g. 'notabool') fail with a clear validation error.
 * Crucially, NEVER uses Boolean(str) which incorrectly converts 'false' to true.
 */
export const booleanQueryParam = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') {
    if (val === 1) return true;
    if (val === 0) return false;
  }
  if (typeof val === 'string') {
    const clean = val.trim().toLowerCase();
    if (clean === '' || clean === 'undefined' || clean === 'null' || clean === 'all') {
      return undefined;
    }
    if (clean === 'true' || clean === '1') return true;
    if (clean === 'false' || clean === '0') return false;
  }
  return val;
}, z.boolean({ invalid_type_error: 'Must be a boolean value (true or false)' }).optional());

/**
 * Explicit numeric parser for pagination (page, limit).
 * Validates positive integers, enforces max limit bounds, and provides sensible defaults.
 */
export const positiveIntQueryParam = (defaultVal?: number, maxVal: number = 1000) =>
  z.preprocess((val) => {
    if (val === undefined || val === null) return defaultVal;
    if (typeof val === 'string') {
      const clean = val.trim();
      if (clean === '' || clean === 'undefined' || clean === 'null') return defaultVal;
    }
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number({ invalid_type_error: 'Must be a valid integer number' })
      .int('Must be an integer')
      .positive('Must be a positive integer greater than 0')
      .max(maxVal, `Cannot exceed maximum allowed value of ${maxVal}`)
      .optional()
      .default(defaultVal ?? 1));

/**
 * Safe search string preprocessor.
 * Trims whitespace, turns empty strings into undefined, and enforces maximum search length.
 */
export const searchQueryParam = (maxLen: number = 200) =>
  z.preprocess((val) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string') {
      const clean = val.trim();
      if (clean === '' || clean === 'undefined' || clean === 'null') return undefined;
      return clean;
    }
    return undefined;
  }, z.string().max(maxLen, `Search query must be ${maxLen} characters or fewer`).optional());

/**
 * MongoDB ObjectId 24-character hexadecimal regex pattern
 */
export const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Zod schema for validating a document ID parameter (e.g. :id).
 * Guarantees that only valid 24-character hex strings reach findById handlers,
 * preventing unhandled Mongoose CastError exceptions.
 */
export const objectIdSchema = z
  .string({ required_error: 'ID is required' })
  .trim()
  .regex(objectIdRegex, 'Invalid ID format for _id');

export const objectIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Preprocessor for optional ObjectId query parameters (such as selectedId in dropdown options).
 * Converts empty strings, 'undefined', 'null' into undefined; validates hex format if present.
 */
export const optionalObjectIdQueryParam = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    const clean = val.trim();
    if (clean === '' || clean === 'undefined' || clean === 'null') return undefined;
    return clean;
  }
  return val;
}, z.string().regex(objectIdRegex, 'Invalid ID format for _id').optional());


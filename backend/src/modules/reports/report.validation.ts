import { z } from 'zod';

export const matrixStatementQuerySchema = z.object({
  search: z.string().trim().optional(),
  productId: z.string().optional(),
  areaId: z.string().optional(),
});

export const periodStatementQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  productId: z.string().optional(),
  areaId: z.string().optional(),
  search: z.string().trim().optional(),
});

export type MatrixStatementQueryInput = z.infer<typeof matrixStatementQuerySchema>;
export type PeriodStatementQueryInput = z.infer<typeof periodStatementQuerySchema>;


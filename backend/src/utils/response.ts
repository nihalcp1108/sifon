import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
  error?: {
    code?: string;
    details?: any;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {}),
  };
  return res.status(statusCode).json(payload);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): Response {
  return sendSuccess(res, data, message, 201);
}


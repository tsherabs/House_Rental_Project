import { InjectionToken } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export const API_BASE = new InjectionToken<string>('API_BASE', { providedIn: 'root', factory: () => '/api/v1' });
export interface Page<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface Failure { message: string; details: { field: string; message: string }[] }
export function failureFrom(error: HttpErrorResponse): Failure {
  const messages: Record<number, string> = {
    0: 'Cannot reach the server. Check your connection and try again.',
    400: 'Check the highlighted fields and try again.', 401: 'Please sign in again. Your session may have expired.',
    403: 'This action is not permitted. Your account or session may no longer be active.',
    404: 'This item could not be found or is no longer accessible.',
    409: 'This item has changed or already exists. Refresh and try again.',
    413: 'The selected files exceed the upload limit.', 415: 'Choose JPEG, PNG or WebP images.',
    429: 'Too many attempts. Please wait before trying again.',
  };
  return { message: messages[error.status] ?? 'Something went wrong. Please try again.',
    details: error.status === 400 && Array.isArray(error.error?.error?.details) ? error.error.error.details : [] };
}

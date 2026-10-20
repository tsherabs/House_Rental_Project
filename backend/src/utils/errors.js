export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
export const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
export const forbidden = () => new ApiError(403, 'FORBIDDEN', 'Action not permitted');
export const conflict = (message) => new ApiError(409, 'CONFLICT', message);

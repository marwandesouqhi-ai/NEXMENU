export class AppError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") { super("UNAUTHORIZED", message); }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") { super("FORBIDDEN", message); }
}
export class NotFoundError extends AppError {
  constructor(message = "The requested item was not found.") { super("NOT_FOUND", message); }
}
export class PlanLimitError extends AppError {
  constructor(message: string) { super("PLAN_LIMIT", message); }
}
export class ValidationError extends AppError {
  constructor(message: string) { super("VALIDATION", message); }
}

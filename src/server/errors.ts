export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

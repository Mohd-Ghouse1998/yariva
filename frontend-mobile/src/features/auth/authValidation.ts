export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

export function signupPasswordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "Use at least 10 characters.";
  if (password.length > PASSWORD_MAX_LENGTH) return "Use no more than 72 characters.";
  return null;
}

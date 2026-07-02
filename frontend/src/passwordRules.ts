// frontend/src/passwordRules.ts
// Shared password-strength rule set — split out from PasswordStrength.tsx so
// that component file only exports the component (react-refresh requires
// this for fast-refresh to work), while LoginPage's validate() and the
// PasswordStrength component both consume the same single source of truth.
export const REQUIREMENTS = [
  { regex: /.{8,}/, text: "At least 8 characters" },
  { regex: /[0-9]/, text: "At least 1 number" },
  { regex: /[a-z]/, text: "At least 1 lowercase letter" },
  { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
  { regex: /[!-/:-@[-`{-~]/, text: "At least 1 special character" },
] as const;

// Registration is blocked below this score (see LoginPage's validate()).
export const MIN_STRENGTH_SCORE = 3;

export function passwordScore(password: string): number {
  return REQUIREMENTS.reduce((n, r) => n + (r.regex.test(password) ? 1 : 0), 0);
}

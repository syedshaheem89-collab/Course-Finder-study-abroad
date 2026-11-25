const BANNED_SUBSTRINGS = [
  'password',
  'admin123',
  'qwerty',
  '123456',
  'letmein',
  'welcome',
  'globalcourse',
];

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const val = typeof password === 'string' ? password : '';

  if (val.length < 12 || val.length > 128) {
    errors.push('Password must be between 12 and 128 characters long.');
  }
  if (!/[A-Z]/.test(val)) {
    errors.push('Password must include at least one uppercase letter (A-Z).');
  }
  if (!/[a-z]/.test(val)) {
    errors.push('Password must include at least one lowercase letter (a-z).');
  }
  if (!/[0-9]/.test(val)) {
    errors.push('Password must include at least one number (0-9).');
  }
  if (!/[^A-Za-z0-9]/.test(val)) {
    errors.push('Password must include at least one special character (e.g. !@#$%^&*).');
  }

  const lower = val.toLowerCase();
  for (const banned of BANNED_SUBSTRINGS) {
    if (lower.includes(banned)) {
      errors.push(`Password cannot contain common or predictable words ("${banned}").`);
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

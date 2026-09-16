/**
 * Validation utilities for UChat
 */

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  // 3-20 chars, alphanumeric + underscores, cannot start or end with underscore
  const re = /^[a-zA-Z0-9][a-zA-Z0-9_]{1,18}[a-zA-Z0-9]$/;
  return re.test(username.trim());
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long' };
  }
  return { valid: true };
}

export function sanitizeUsername(username) {
  if (!username) return '';
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

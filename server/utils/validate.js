/**
 * Lightweight input validation for the API.
 * Every value from the client is treated as untrusted.
 */

export const isEmail = (value) =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && value.length <= 254;

export const isPassword = (value) => typeof value === "string" && value.length >= 8 && value.length <= 128;

export const isName = (value) =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 80;

export const isOrgName = (value) =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 255;

export const isId = (value) => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

export const isEnum = (value, allowed) => typeof value === "string" && allowed.includes(value);

/**
 * Validate a body against a schema of { field: predicate }.
 * Returns an array of human-readable errors (empty = valid).
 */
export function validateBody(body, schema) {
  const errors = [];
  for (const [field, predicate] of Object.entries(schema)) {
    if (!predicate(body[field])) {
      errors.push(`Invalid ${field}`);
    }
  }
  return errors;
}

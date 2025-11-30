/**
 * Type utilities for safe JSON field parsing and type validation.
 * Provides runtime type guards and safe parsing for Supabase JSON fields.
 */

import type { Json } from '@/integrations/supabase/types';

/**
 * Safely parses a JSON field from Supabase to a typed value.
 * @param json - The raw JSON value from Supabase
 * @param validator - Optional type guard to validate the parsed value
 * @returns The typed value or null if invalid
 */
export function parseJsonField<T>(
  json: Json | null | undefined,
  validator?: (v: unknown) => v is T
): T | null {
  if (json === null || json === undefined) return null;
  if (validator && !validator(json)) return null;
  return json as T;
}

/**
 * Safely parses a JSON field with a default value.
 */
export function parseJsonFieldWithDefault<T>(
  json: Json | null | undefined,
  defaultValue: T,
  validator?: (v: unknown) => v is T
): T {
  const parsed = parseJsonField(json, validator);
  return parsed ?? defaultValue;
}

/**
 * Type guard for checking if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for checking if a value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for checking if a value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for checking if a value is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for string arrays.
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

/**
 * Safely extracts a string property from an object.
 */
export function getStringProp(obj: unknown, key: string): string | null {
  if (!isObject(obj)) return null;
  const value = obj[key];
  return isString(value) ? value : null;
}

/**
 * Safely extracts a number property from an object.
 */
export function getNumberProp(obj: unknown, key: string): number | null {
  if (!isObject(obj)) return null;
  const value = obj[key];
  return isNumber(value) ? value : null;
}

/**
 * Safely extracts an array property from an object.
 */
export function getArrayProp<T>(
  obj: unknown, 
  key: string, 
  itemValidator?: (v: unknown) => v is T
): T[] | null {
  if (!isObject(obj)) return null;
  const value = obj[key];
  if (!isArray(value)) return null;
  if (itemValidator) {
    return value.every(itemValidator) ? (value as T[]) : null;
  }
  return value as T[];
}

export interface FieldChange {
  before: unknown;
  after: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Walks two object trees and returns a flat map of dot-path -> {before, after} for
 * every leaf value that differs. Arrays and dates are compared as whole leaf values
 * (not diffed element-by-element) — sufficient for an audit-log style change record.
 */
export function diffObjects(before: unknown, after: unknown, pathPrefix = ''): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};

  function walk(a: unknown, b: unknown, path: string): void {
    if (isPlainObject(a) && isPlainObject(b)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        walk(a[key], b[key], path ? `${path}.${key}` : key);
      }
      return;
    }

    if (!isEqual(a, b)) {
      changes[path] = { before: a, after: b };
    }
  }

  walk(before, after, pathPrefix);
  return changes;
}

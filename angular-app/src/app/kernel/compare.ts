/**
 * Typed, three-valued comparison. Unlike the original `===`-based engine this:
 *   - coerces the actual value toward the attribute's declared type, so a DB
 *     string "34" matches a rule's numeric 34 instead of silently failing;
 *   - returns UNKNOWN (not FALSE) when data is missing or an ordering operator
 *     is applied to a non-orderable value, so a real gap is never disguised as
 *     a legitimate non-match;
 *   - treats `exists` / `not_exists` as total — they are defined on missing data.
 */

import { ComparisonOperator, NULLARY_OPERATORS, ORDERING_OPERATORS } from './ast';
import { Truth, fromBool } from './logic';
import { AttrType } from './schema';

const MISSING = Symbol('missing');

/** Coerce a raw value toward an attribute type. Returns MISSING if uncoercible. */
function coerceToType(value: any, type: AttrType | undefined): any {
  if (value === null || value === undefined) return MISSING;
  if (!type) return value;

  switch (type.kind) {
    case 'int':
    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value);
      }
      return MISSING;
    }
    case 'bool': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return MISSING;
    }
    case 'date': {
      const ts = value instanceof Date ? value.getTime() : Date.parse(String(value));
      return Number.isNaN(ts) ? MISSING : ts;
    }
    case 'array':
      return Array.isArray(value) ? value : MISSING;
    default:
      return value; // string / enum compared as-is
  }
}

/** Coerce the rule's expected operand the same way (for symmetric comparison). */
function coerceExpected(value: any, type: AttrType | undefined): any {
  if (!type) return value;
  if (type.kind === 'int' || type.kind === 'number') {
    return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))
      ? Number(value)
      : value;
  }
  if (type.kind === 'date') {
    const ts = value instanceof Date ? value.getTime() : Date.parse(String(value));
    return Number.isNaN(ts) ? value : ts;
  }
  return value;
}

function elementType(type: AttrType | undefined): AttrType | undefined {
  return type?.kind === 'array' ? type.of : undefined;
}

/**
 * Compare an actual value against a rule operand. `type` is the declared type of
 * the actual's attribute (optional — falls back to structural comparison).
 */
export function compareTyped(
  actual: any,
  operator: ComparisonOperator,
  expected: any,
  type?: AttrType,
): Truth {
  // Presence checks are total — defined even when the value is missing.
  if (NULLARY_OPERATORS.has(operator)) {
    const present = actual !== null && actual !== undefined;
    return operator === 'exists' ? fromBool(present) : fromBool(!present);
  }

  // Membership reads into the actual container; coerce the container itself.
  if (operator === 'contains' || operator === 'not_contains') {
    if (actual === null || actual === undefined) return 'UNKNOWN';
    const needle = coerceExpected(expected, elementType(type));
    if (Array.isArray(actual)) {
      const hit = actual.some((el) => el === needle || el === expected);
      return fromBool(operator === 'contains' ? hit : !hit);
    }
    if (typeof actual === 'string') {
      const hit = actual.includes(String(expected));
      return fromBool(operator === 'contains' ? hit : !hit);
    }
    return 'UNKNOWN';
  }

  // `in` / `not_in` test the actual against a rule-supplied set.
  if (operator === 'in' || operator === 'not_in') {
    if (actual === null || actual === undefined) return 'UNKNOWN';
    if (!Array.isArray(expected)) return 'UNKNOWN';
    const a = coerceToType(actual, type);
    const set = expected.map((e) => coerceExpected(e, type));
    const hit = set.includes(a === MISSING ? actual : a);
    return fromBool(operator === 'in' ? hit : !hit);
  }

  // Equality / ordering on a scalar.
  const a = coerceToType(actual, type);
  if (a === MISSING) return 'UNKNOWN'; // missing or uncoercible data → can't decide
  const e = coerceExpected(expected, type);

  switch (operator) {
    case 'equal_to':
      return fromBool(a === e);
    case 'not_equal_to':
      return fromBool(a !== e);
    case 'greater_than':
    case 'greater_than_equal':
    case 'less_than':
    case 'less_than_equal': {
      // Ordering requires both sides numeric (dates are coerced to epoch ms).
      if (typeof a !== 'number' || typeof e !== 'number') return 'UNKNOWN';
      if (operator === 'greater_than') return fromBool(a > e);
      if (operator === 'greater_than_equal') return fromBool(a >= e);
      if (operator === 'less_than') return fromBool(a < e);
      return fromBool(a <= e);
    }
    default:
      return 'UNKNOWN';
  }
}

export { ORDERING_OPERATORS };

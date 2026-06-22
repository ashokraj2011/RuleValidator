/**
 * Three-valued (Kleene) logic. Missing or unevaluable data is `UNKNOWN`, which
 * is propagated rather than silently collapsed to `FALSE`. This lets the engine
 * distinguish "the rule failed" from "we could not evaluate the rule".
 */

export type Truth = 'TRUE' | 'FALSE' | 'UNKNOWN';

/** Map a strict boolean into the three-valued domain. */
export function fromBool(b: boolean): Truth {
  return b ? 'TRUE' : 'FALSE';
}

/**
 * Kleene AND over a sequence: FALSE if any operand is FALSE (dominant),
 * else UNKNOWN if any operand is UNKNOWN, else TRUE.
 */
export function andAll(values: Truth[]): Truth {
  let unknown = false;
  for (const v of values) {
    if (v === 'FALSE') return 'FALSE';
    if (v === 'UNKNOWN') unknown = true;
  }
  return unknown ? 'UNKNOWN' : 'TRUE';
}

/**
 * Kleene OR over a sequence: TRUE if any operand is TRUE (dominant),
 * else UNKNOWN if any operand is UNKNOWN, else FALSE.
 */
export function orAll(values: Truth[]): Truth {
  let unknown = false;
  for (const v of values) {
    if (v === 'TRUE') return 'TRUE';
    if (v === 'UNKNOWN') unknown = true;
  }
  return unknown ? 'UNKNOWN' : 'FALSE';
}

/** Kleene NOT: TRUE↔FALSE, UNKNOWN is fixed. */
export function not3(v: Truth): Truth {
  if (v === 'TRUE') return 'FALSE';
  if (v === 'FALSE') return 'TRUE';
  return 'UNKNOWN';
}

/** In AND, FALSE is decisive — once seen the rest can be short-circuited. */
export function isAndDecisive(v: Truth): boolean {
  return v === 'FALSE';
}

/** In OR, TRUE is decisive — once seen the rest can be short-circuited. */
export function isOrDecisive(v: Truth): boolean {
  return v === 'TRUE';
}

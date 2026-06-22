/**
 * Typed attribute registry. Declares the type of every `namespace.attribute`
 * once, so the comparator can coerce sanely (string "34" → 34 for an int) and
 * the static linter can reject nonsense (`contains` on an int) before any data
 * is involved.
 */

export type AttrType =
  | { kind: 'int' }
  | { kind: 'number' }
  | { kind: 'bool' }
  | { kind: 'string' }
  | { kind: 'enum'; values: string[] }
  | { kind: 'date' }
  | { kind: 'array'; of: AttrType };

export type NamespaceSource = 'db' | 'session';

export interface NamespaceDef {
  namespace: string;
  /** Where the data originates: a backing store, or the caller at eval time. */
  source: NamespaceSource;
  attributes: Record<string, AttrType>;
}

export interface AttributeDef {
  namespace: string;
  attribute: string;
  type: AttrType;
  source: NamespaceSource;
}

export function typeLabel(t: AttrType): string {
  switch (t.kind) {
    case 'enum':
      return `enum<${t.values.join('|')}>`;
    case 'array':
      return `array<${typeLabel(t.of)}>`;
    default:
      return t.kind;
  }
}

export class SchemaRegistry {
  private readonly byNamespace = new Map<string, NamespaceDef>();

  constructor(defs: NamespaceDef[] = []) {
    for (const def of defs) this.byNamespace.set(def.namespace, def);
  }

  hasNamespace(namespace: string): boolean {
    return this.byNamespace.has(namespace);
  }

  getNamespace(namespace: string): NamespaceDef | undefined {
    return this.byNamespace.get(namespace);
  }

  isSession(namespace: string): boolean {
    return this.byNamespace.get(namespace)?.source === 'session';
  }

  /** Resolve a single attribute definition, or undefined if not declared. */
  get(namespace: string, attribute: string): AttributeDef | undefined {
    const ns = this.byNamespace.get(namespace);
    const type = ns?.attributes[attribute];
    if (!ns || !type) return undefined;
    return { namespace, attribute, type, source: ns.source };
  }

  all(): NamespaceDef[] {
    return Array.from(this.byNamespace.values());
  }
}

/**
 * Default schema for the demo. Mirrors the shapes in `mock-db.service.ts` plus
 * the session namespace used by `rule_5`. In a real deployment this would be
 * loaded from a schema service rather than hard-coded.
 */
export const SAMPLE_SCHEMA = new SchemaRegistry([
  {
    namespace: 'customer',
    source: 'db',
    attributes: {
      id: { kind: 'string' },
      name: { kind: 'string' },
      age: { kind: 'int' },
      country: { kind: 'enum', values: ['US', 'CA', 'MX', 'GB', 'DE', 'FR'] },
      status: { kind: 'enum', values: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'DORMANT'] },
      tier: { kind: 'enum', values: ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM'] },
      tags: { kind: 'array', of: { kind: 'string' } },
      email: { kind: 'string' },
      last_login: { kind: 'date' },
    },
  },
  {
    namespace: 'account',
    source: 'db',
    attributes: {
      id: { kind: 'string' },
      customer_id: { kind: 'string' },
      type: { kind: 'enum', values: ['CHECKING', 'SAVINGS', 'INVESTMENT'] },
      balance: { kind: 'number' },
      currency: { kind: 'enum', values: ['USD', 'CAD', 'EUR', 'GBP'] },
      credit_limit: { kind: 'number' },
      opened_date: { kind: 'date' },
    },
  },
  {
    namespace: 'product',
    source: 'db',
    attributes: {
      id: { kind: 'string' },
      name: { kind: 'string' },
      category: { kind: 'enum', values: ['CREDIT_CARD', 'INVESTMENT', 'LOAN'] },
      eligible_countries: { kind: 'array', of: { kind: 'string' } },
      min_age: { kind: 'int' },
      min_balance: { kind: 'number' },
      status: { kind: 'enum', values: ['ACTIVE', 'INACTIVE'] },
    },
  },
  {
    namespace: 'campaign',
    source: 'db',
    attributes: {
      id: { kind: 'string' },
      name: { kind: 'string' },
      type: { kind: 'enum', values: ['CROSS_SELL', 'UPSELL', 'RETENTION'] },
      status: { kind: 'enum', values: ['ACTIVE', 'INACTIVE'] },
      target_segments: { kind: 'array', of: { kind: 'string' } },
      min_customer_age: { kind: 'int' },
    },
  },
  {
    namespace: 'order',
    source: 'db',
    attributes: {
      id: { kind: 'string' },
      customer_id: { kind: 'string' },
      total: { kind: 'number' },
      status: { kind: 'enum', values: ['COMPLETED', 'PENDING', 'CANCELLED'] },
      items_count: { kind: 'int' },
    },
  },
  {
    namespace: 'session',
    source: 'session',
    attributes: {
      channel: { kind: 'enum', values: ['WEB', 'MOBILE', 'BRANCH', 'PHONE'] },
      authenticated: { kind: 'bool' },
      device: { kind: 'string' },
    },
  },
]);

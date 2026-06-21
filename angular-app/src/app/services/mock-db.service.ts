import { Injectable } from '@angular/core';
import { NamespaceData, TestDataSnapshot } from '../models/types';

export interface LiveParams {
  personaType: string;
  personaId: string;
  extra: { key: string; value: string }[];
}

export interface LiveFetchResult {
  snapshot: TestDataSnapshot;
  /** Which DB record each namespace resolved to (null = no record, synthesized) */
  matched: Record<string, string | null>;
}

@Injectable({ providedIn: 'root' })
export class MockDbService {
  async fetchFromDb(namespace: string, key: string): Promise<NamespaceData | null> {
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));

    const namespaceStore = MOCK_DB[namespace];
    if (!namespaceStore) {
      return null;
    }

    const record = namespaceStore[key];
    if (!record) {
      return null;
    }

    return JSON.parse(JSON.stringify(record)) as NamespaceData;
  }

  /**
   * Simulate a live platform call: resolve the persona to a record per required
   * namespace and overlay caller-supplied parameters, returning the grounded
   * snapshot the rule engine evaluates. In a real deployment this would call the
   * platform's data service with personaType/personaId; here it is mocked.
   */
  async fetchLiveData(
    params: LiveParams,
    namespaceAttrs: Record<string, string[]>,
  ): Promise<LiveFetchResult> {
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 500));

    const snapshot: TestDataSnapshot = {};
    const matched: Record<string, string | null> = {};
    const id = params.personaId.trim();

    for (const ns of Object.keys(namespaceAttrs)) {
      const store = MOCK_DB[ns];
      const keys = store ? Object.keys(store) : [];
      let matchKey: string | null = null;
      if (store && store[id]) {
        matchKey = id;
      } else if (keys.length) {
        // Deterministically resolve an unknown persona id to a stable record.
        matchKey = keys[hashString(id || params.personaType) % keys.length];
      }
      const base: NamespaceData = matchKey ? JSON.parse(JSON.stringify(store[matchKey])) : {};
      base['persona_type'] = params.personaType;
      base['persona_id'] = id;
      snapshot[ns] = base;
      matched[ns] = matchKey;
    }

    // Overlay caller parameters. "namespace.attribute" targets one namespace;
    // a bare "attribute" is applied across every resolved namespace.
    for (const { key, value } of params.extra) {
      const k = key.trim();
      if (!k) continue;
      const coerced = coerceValue(value);
      if (k.includes('.')) {
        const [ns, attr] = k.split('.', 2);
        snapshot[ns] ??= {};
        snapshot[ns][attr] = coerced;
      } else {
        for (const ns of Object.keys(snapshot)) {
          snapshot[ns][k] = coerced;
        }
      }
    }

    return { snapshot, matched };
  }

  getAvailableKeys(namespace: string): string[] {
    const namespaceStore = MOCK_DB[namespace];
    return namespaceStore ? Object.keys(namespaceStore) : [];
  }

  getAvailableNamespaces(): string[] {
    return Object.keys(MOCK_DB);
  }
}

/** Coerce a string parameter into number / boolean / JSON / string. */
function coerceValue(raw: string): any {
  const v = raw.trim();
  if (v === '') return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (!Number.isNaN(Number(v)) && /^-?\d*\.?\d+$/.test(v)) return Number(v);
  if ((v.startsWith('[') && v.endsWith(']')) || (v.startsWith('{') && v.endsWith('}'))) {
    try { return JSON.parse(v); } catch { /* fall through */ }
  }
  return raw;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const MOCK_DB: Record<string, Record<string, NamespaceData>> = {
  customer: {
    'CUST-001': {
      id: 'CUST-001',
      name: 'Alice Johnson',
      age: 32,
      country: 'US',
      status: 'ACTIVE',
      tier: 'GOLD',
      tags: ['VIP', 'LOYALTY_PROGRAM'],
      email: 'alice@example.com',
      last_login: '2024-11-24T10:30:00Z',
    },
    'CUST-002': {
      id: 'CUST-002',
      name: 'Bob Smith',
      age: 17,
      country: 'CA',
      status: 'PROSPECT',
      tier: 'STANDARD',
      tags: ['NEW_USER'],
      email: 'bob@example.com',
      last_login: '2024-12-01T08:15:00Z',
    },
    'CUST-003': {
      id: 'CUST-003',
      name: 'Carlos Rivera',
      age: 45,
      country: 'MX',
      status: 'ACTIVE',
      tier: 'PLATINUM',
      tags: ['VIP', 'HIGH_VALUE', 'LOYALTY_PROGRAM'],
      email: 'carlos@example.com',
      last_login: '2024-10-15T14:22:00Z',
    },
    'CUST-004': {
      id: 'CUST-004',
      name: 'Diana Chen',
      age: 28,
      country: 'US',
      status: 'INACTIVE',
      tier: 'SILVER',
      tags: ['DORMANT'],
      email: 'diana@example.com',
      last_login: '2023-06-10T09:00:00Z',
    },
  },
  account: {
    'ACC-101': {
      id: 'ACC-101',
      customer_id: 'CUST-001',
      type: 'CHECKING',
      balance: 52000,
      currency: 'USD',
      credit_limit: 10000,
      opened_date: '2020-01-15',
    },
    'ACC-102': {
      id: 'ACC-102',
      customer_id: 'CUST-002',
      type: 'SAVINGS',
      balance: 1200,
      currency: 'CAD',
      credit_limit: 0,
      opened_date: '2024-06-01',
    },
    'ACC-103': {
      id: 'ACC-103',
      customer_id: 'CUST-003',
      type: 'CHECKING',
      balance: 150000,
      currency: 'USD',
      credit_limit: 50000,
      opened_date: '2018-03-20',
    },
  },
  product: {
    'PROD-X1': {
      id: 'PROD-X1',
      name: 'CrossSell Premium Card',
      category: 'CREDIT_CARD',
      eligible_countries: ['US', 'CA'],
      min_age: 18,
      min_balance: 5000,
      status: 'ACTIVE',
    },
    'PROD-X2': {
      id: 'PROD-X2',
      name: 'Wealth Management Suite',
      category: 'INVESTMENT',
      eligible_countries: ['US'],
      min_age: 25,
      min_balance: 50000,
      status: 'ACTIVE',
    },
  },
  campaign: {
    'CAMP-CS01': {
      id: 'CAMP-CS01',
      name: 'Holiday Cross-Sell 2024',
      type: 'CROSS_SELL',
      status: 'ACTIVE',
      start_date: '2024-11-01',
      end_date: '2024-12-31',
      target_segments: ['VIP', 'HIGH_VALUE'],
      min_customer_age: 18,
    },
  },
  order: {
    'ORD-501': {
      id: 'ORD-501',
      customer_id: 'CUST-001',
      total: 2400,
      status: 'COMPLETED',
      items_count: 3,
      placed_at: '2024-11-20T16:00:00Z',
    },
    'ORD-502': {
      id: 'ORD-502',
      customer_id: 'CUST-003',
      total: 15800,
      status: 'PENDING',
      items_count: 7,
      placed_at: '2024-12-02T11:30:00Z',
    },
  },
};

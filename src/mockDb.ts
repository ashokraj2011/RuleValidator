import { NamespaceData } from './types';

// Simulated database records keyed by namespace → lookup key → data
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
      balance: 52000.0,
      currency: 'USD',
      credit_limit: 10000,
      opened_date: '2020-01-15',
    },
    'ACC-102': {
      id: 'ACC-102',
      customer_id: 'CUST-002',
      type: 'SAVINGS',
      balance: 1200.0,
      currency: 'CAD',
      credit_limit: 0,
      opened_date: '2024-06-01',
    },
    'ACC-103': {
      id: 'ACC-103',
      customer_id: 'CUST-003',
      type: 'CHECKING',
      balance: 150000.0,
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
      total: 2400.0,
      status: 'COMPLETED',
      items_count: 3,
      placed_at: '2024-11-20T16:00:00Z',
    },
    'ORD-502': {
      id: 'ORD-502',
      customer_id: 'CUST-003',
      total: 15800.0,
      status: 'PENDING',
      items_count: 7,
      placed_at: '2024-12-02T11:30:00Z',
    },
  },
};

// Simulated async DB fetch — returns a copy of the data
export async function fetchFromDb(
  namespace: string,
  key: string
): Promise<NamespaceData | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));

  const nsStore = MOCK_DB[namespace];
  if (!nsStore) return null;

  const record = nsStore[key];
  if (!record) return null;

  // Return a deep copy so edits don't affect the "DB"
  return JSON.parse(JSON.stringify(record));
}

// Get available keys for a namespace (for autocomplete/dropdown)
export function getAvailableKeys(namespace: string): string[] {
  const nsStore = MOCK_DB[namespace];
  if (!nsStore) return [];
  return Object.keys(nsStore);
}

// Get all available namespaces in the DB
export function getAvailableNamespaces(): string[] {
  return Object.keys(MOCK_DB);
}

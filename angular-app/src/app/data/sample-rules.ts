import { Rule } from '../models/types';

// Sample rules demonstrating the grammar, including chained rules

export const SAMPLE_RULES: Rule[] = [
  {
    rule_id: 'rule_1',
    name: 'Adult customer from US or CA',
    terms: {
      operator: 'AND',
      terms: [
        {
          namespace: 'customer',
          attribute: 'age',
          operator: 'greater_than_equal',
          value: 18,
        },
        {
          operator: 'OR',
          terms: [
            {
              namespace: 'customer',
              attribute: 'country',
              operator: 'equal_to',
              value: 'US',
            },
            {
              namespace: 'customer',
              attribute: 'country',
              operator: 'equal_to',
              value: 'CA',
            },
          ],
        },
      ],
    },
  },
  {
    rule_id: 'rule_2',
    name: 'Active customer with VIP tag',
    terms: {
      operator: 'AND',
      terms: [
        {
          namespace: 'customer',
          attribute: 'status',
          operator: 'equal_to',
          value: 'ACTIVE',
        },
        {
          namespace: 'customer',
          attribute: 'tags',
          operator: 'contains',
          value: 'VIP',
        },
      ],
    },
  },
  {
    rule_id: 'rule_3',
    name: 'CrossSell Campaign Eligibility',
    terms: {
      operator: 'AND',
      terms: [
        // Chain rule_1 — must be adult from US/CA
        { rule_ref: 'rule_1' },
        // Chain rule_2 — must be active VIP
        { rule_ref: 'rule_2' },
        // Additional: account balance threshold
        {
          namespace: 'account',
          attribute: 'balance',
          operator: 'greater_than',
          value: 5000,
        },
      ],
    },
  },
  {
    rule_id: 'rule_4',
    name: 'High-value customer check',
    terms: {
      operator: 'AND',
      terms: [
        {
          namespace: 'customer',
          attribute: 'tier',
          operator: 'in',
          value: ['GOLD', 'PLATINUM'],
        },
        {
          namespace: 'account',
          attribute: 'balance',
          operator: 'greater_than_equal',
          value: 50000,
        },
        {
          operator: 'OR',
          terms: [
            {
              namespace: 'account',
              attribute: 'type',
              operator: 'equal_to',
              value: 'CHECKING',
            },
            {
              namespace: 'account',
              attribute: 'type',
              operator: 'equal_to',
              value: 'INVESTMENT',
            },
          ],
        },
      ],
    },
  },
  {
    rule_id: 'rule_5',
    name: 'Authenticated web session — adult US/CA customer',
    terms: {
      operator: 'AND',
      terms: [
        // Chain rule_1 — must be adult from US/CA (DB-backed customer data)
        { rule_ref: 'rule_1' },
        // Session data supplied by the calling application at evaluation time
        {
          namespace: 'session',
          attribute: 'channel',
          operator: 'equal_to',
          value: 'WEB',
        },
        {
          namespace: 'session',
          attribute: 'authenticated',
          operator: 'equal_to',
          value: true,
        },
      ],
    },
  },
];

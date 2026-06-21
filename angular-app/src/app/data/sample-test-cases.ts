import { Rule, TestCase, TestCaseRunResult, TestDataSnapshot } from '../models/types';
import { RuleEngineService } from '../services/rule-engine.service';

interface SeedCase {
  id: string;
  name: string;
  description: string;
  ruleId: string;
  dbKeys: Record<string, string>;
  snapshot: TestDataSnapshot;
  /** how many historical runs to fabricate for this case */
  runs?: number;
  /** asserted expected outcome */
  expected?: 'PASSED' | 'FAILED';
}

// Demo test cases per rule, mixing PASS / FAIL / short-circuit scenarios so the
// Test Cases manager, Coverage heatmap and Dashboard all show realistic data.
const SEED_CASES: SeedCase[] = [
  // --- rule_1: Adult customer from US or CA ---
  {
    id: 'tc_seed_1',
    name: 'Adult US customer',
    description: '34 year-old active customer based in the US — should qualify.',
    ruleId: 'rule_1',
    dbKeys: { customer: 'CUST-10042' },
    snapshot: { customer: { age: 34, country: 'US', status: 'ACTIVE', tags: ['VIP', 'EARLY_ADOPTER'] } },
    runs: 3,
    expected: 'PASSED',
  },
  {
    id: 'tc_seed_2',
    name: 'Minor applicant',
    description: '16 year-old — fails the age gate, country check should short-circuit.',
    ruleId: 'rule_1',
    dbKeys: { customer: 'CUST-20881' },
    snapshot: { customer: { age: 16, country: 'US', status: 'ACTIVE', tags: [] } },
    runs: 2,
    expected: 'FAILED',
  },
  {
    id: 'tc_seed_3',
    name: 'Adult from UK',
    description: 'Adult but located in GB — passes age, fails both country options.',
    ruleId: 'rule_1',
    dbKeys: { customer: 'CUST-33150' },
    snapshot: { customer: { age: 41, country: 'GB', status: 'ACTIVE', tags: ['VIP'] } },
    runs: 1,
    expected: 'PASSED',
  },

  // --- rule_2: Active customer with VIP tag ---
  {
    id: 'tc_seed_4',
    name: 'Active VIP member',
    description: 'Active customer carrying the VIP tag — should pass.',
    ruleId: 'rule_2',
    dbKeys: { customer: 'CUST-10042' },
    snapshot: { customer: { status: 'ACTIVE', tags: ['VIP', 'EARLY_ADOPTER'] } },
    runs: 2,
    expected: 'PASSED',
  },
  {
    id: 'tc_seed_5',
    name: 'Inactive VIP',
    description: 'VIP tag present but account inactive — status fails, tags short-circuit.',
    ruleId: 'rule_2',
    dbKeys: { customer: 'CUST-77231' },
    snapshot: { customer: { status: 'INACTIVE', tags: ['VIP'] } },
    runs: 1,
    expected: 'FAILED',
  },

  // --- rule_3: CrossSell Campaign Eligibility (chains rule_1 + rule_2) ---
  {
    id: 'tc_seed_6',
    name: 'Eligible cross-sell candidate',
    description: 'Adult US active VIP with a healthy balance — passes the full chain.',
    ruleId: 'rule_3',
    dbKeys: { customer: 'CUST-10042', account: 'ACCT-55012' },
    snapshot: {
      customer: { age: 34, country: 'US', status: 'ACTIVE', tags: ['VIP', 'EARLY_ADOPTER'] },
      account: { balance: 8200, type: 'CHECKING' },
    },
    runs: 2,
    expected: 'PASSED',
  },
  {
    id: 'tc_seed_7',
    name: 'Low balance candidate',
    description: 'Meets rule_1 and rule_2 but balance below 5000 — fails on balance.',
    ruleId: 'rule_3',
    dbKeys: { customer: 'CUST-10042', account: 'ACCT-90418' },
    snapshot: {
      customer: { age: 34, country: 'US', status: 'ACTIVE', tags: ['VIP'] },
      account: { balance: 1200, type: 'CHECKING' },
    },
    runs: 1,
    expected: 'FAILED',
  },

  // --- rule_4: High-value customer check ---
  {
    id: 'tc_seed_8',
    name: 'Platinum investor',
    description: 'Platinum tier, large balance, investment account — passes.',
    ruleId: 'rule_4',
    dbKeys: { customer: 'CUST-44120', account: 'ACCT-12009' },
    snapshot: {
      customer: { tier: 'PLATINUM' },
      account: { balance: 75000, type: 'INVESTMENT' },
    },
    runs: 2,
    expected: 'PASSED',
  },
  {
    id: 'tc_seed_9',
    name: 'Gold tier, low balance',
    description: 'Gold tier but balance under threshold — fails, account type short-circuits.',
    ruleId: 'rule_4',
    dbKeys: { customer: 'CUST-61887', account: 'ACCT-30222' },
    snapshot: {
      customer: { tier: 'GOLD' },
      account: { balance: 20000, type: 'CHECKING' },
    },
    runs: 1,
    expected: 'FAILED',
  },
];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Auto-generate a PASS and a FAIL test case for a rule by synthesizing data
 * that drives the rule TRUE and FALSE. Session/other inputs are synthesized
 * too — the engine supplies them at call time. Returns the two cases plus a
 * verifying run for each.
 */
export function generateSystemCases(
  engine: RuleEngineService,
  rule: Rule,
  allRules: Rule[],
  now = Date.now(),
): { cases: TestCase[]; runs: TestCaseRunResult[] } {
  const cases: TestCase[] = [];
  const runs: TestCaseRunResult[] = [];
  const specs: { target: boolean; expected: 'PASSED' | 'FAILED' }[] = [
    { target: true, expected: 'PASSED' },
    { target: false, expected: 'FAILED' },
  ];

  specs.forEach((spec, i) => {
    const snapshot = engine.synthesizeSnapshot(rule, spec.target, allRules);
    const evalResult = engine.evaluateRule(rule, snapshot, allRules);
    const status: 'PASSED' | 'FAILED' = evalResult.status === 'PASSED' ? 'PASSED' : 'FAILED';
    const assertion: 'match' | 'mismatch' = status === spec.expected ? 'match' : 'mismatch';
    const assertionClass: 'match' | 'bug' = assertion === 'match' ? 'match' : 'bug';
    const id = `tc_sys_${rule.rule_id}_${spec.expected.toLowerCase()}`;
    const runAt = new Date(now - i * 1000).toISOString();

    const dbKeys: Record<string, string> = {};
    for (const ns of engine.extractNamespaces(rule, allRules)) {
      if (!engine.isSessionNamespace(ns)) dbKeys[ns] = `AUTO-${ns.toUpperCase()}`;
    }

    cases.push({
      id,
      name: `[auto] ${rule.name} — expect ${spec.expected}`,
      description: `System-generated ${spec.expected === 'PASSED' ? 'positive' : 'negative'} case. Data was synthesized to make the rule evaluate ${spec.target ? 'TRUE' : 'FALSE'}; the engine supplies session and other call details at evaluation time.`,
      ruleId: rule.rule_id,
      source: 'system',
      dbKeys,
      snapshot,
      invocation: { personaType: 'MID', personaId: `AUTO-${spec.expected}`, requestParams: [] },
      createdAt: new Date(now).toISOString(),
      lastRunAt: runAt,
      lastResult: status,
      expectedResult: spec.expected,
      expectedSnapshot: snapshot,
      lastAssertion: assertion,
      lastAssertionClass: assertionClass,
    });

    runs.push({
      id: `run_sys_${rule.rule_id}_${i}`,
      testCaseId: id,
      ruleId: rule.rule_id,
      runAt,
      evalResult,
      snapshot,
      expectedResult: spec.expected,
      assertion,
      assertionClass,
      dataChanged: false,
    });
  });

  return { cases, runs };
}

export function buildSampleData(
  engine: RuleEngineService,
  rules: Rule[],
): { testCases: TestCase[]; runHistory: TestCaseRunResult[] } {
  const now = Date.now();
  const testCases: TestCase[] = [];
  const runHistory: TestCaseRunResult[] = [];
  let runSeq = 0;

  SEED_CASES.forEach((seed, caseIdx) => {
    const rule = rules.find((r) => r.rule_id === seed.ruleId);
    if (!rule) return;

    const createdAt = new Date(now - (SEED_CASES.length - caseIdx) * DAY).toISOString();
    const numRuns = seed.runs ?? 1;
    let lastRunAt: string | undefined;
    let lastResult: 'PASSED' | 'FAILED' | undefined;
    let lastAssertion: 'match' | 'mismatch' | 'none' = 'none';
    let lastAssertionClass: 'match' | 'bug' | 'drift' | 'none' = 'none';

    for (let i = 0; i < numRuns; i++) {
      const evalResult = engine.evaluateRule(rule, seed.snapshot, rules);
      const status = evalResult.status === 'PASSED' ? 'PASSED' : 'FAILED';
      const assertion: 'match' | 'mismatch' | 'none' = !seed.expected ? 'none' : status === seed.expected ? 'match' : 'mismatch';
      // Seed data never changes, so any mismatch is a same-data contradiction → a likely rule bug.
      const assertionClass: 'match' | 'bug' | 'drift' | 'none' =
        assertion === 'none' ? 'none' : assertion === 'match' ? 'match' : 'bug';
      // space runs out over the last few days, newest last
      const runAt = new Date(
        now - (numRuns - 1 - i) * (DAY / 2) - caseIdx * 60 * 60 * 1000,
      ).toISOString();
      runHistory.push({
        id: `run_seed_${runSeq++}`,
        testCaseId: seed.id,
        ruleId: seed.ruleId,
        runAt,
        evalResult,
        snapshot: seed.snapshot,
        expectedResult: seed.expected,
        assertion,
        assertionClass,
        dataChanged: false,
      });
      lastRunAt = runAt;
      lastResult = status;
      lastAssertion = assertion;
      lastAssertionClass = assertionClass;
    }

    testCases.push({
      id: seed.id,
      name: seed.name,
      description: seed.description,
      ruleId: seed.ruleId,
      source: 'user',
      dbKeys: seed.dbKeys,
      snapshot: seed.snapshot,
      createdAt,
      lastRunAt,
      lastResult,
      expectedResult: seed.expected,
      expectedSnapshot: seed.expected ? seed.snapshot : undefined,
      lastAssertion,
      lastAssertionClass,
    });
  });

  // Auto-generate a PASS + FAIL case for every rule (system-generated baseline).
  rules.forEach((rule) => {
    const { cases, runs } = generateSystemCases(engine, rule, rules, now);
    testCases.push(...cases);
    runHistory.push(...runs);
  });

  return { testCases, runHistory };
}

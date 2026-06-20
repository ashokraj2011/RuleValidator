export type ActiveTab = 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage';

export interface TestCaseRun {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'passed' | 'failed' | 'pending';
  timestamp: string;
}

export interface LogicPathNode {
  id: string;
  expression: string;
  hits?: number;
  misses?: number;
  isRegression?: boolean;
}

export interface UncoveredScenario {
  id: string;
  risk: 'HIGH RISK' | 'MEDIUM';
  title: string;
  description: string;
}

export interface PendingCase {
  id: string;
  name: string;
  description: string;
  focus: string;
  bgClass?: string;
  textClass?: string;
}

export interface CoverageItem {
  id: string;
  namespace: string;
  rulesCount: number;
  pathsExecuted: string;
  percent: number;
  statusClass: string;
}

export interface Dataset {
  customer: {
    id: string;
    age: number;
    status: 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | string;
    tags: string[];
    last_login: string;
  };
}

export interface EvaluationNode {
  id: string;
  expression: string;
  actual?: string | number;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
}

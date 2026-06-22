/**
 * @rules/kernel — the framework-agnostic core of the Rule Testing Studio.
 *
 * Pure TypeScript, zero Angular imports, fully unit-testable. The Angular app
 * (services, components) depends on this; the kernel never depends on the app.
 * It could equally back a CLI or a CI check.
 */

export * from './ast';
export * from './logic';
export * from './schema';
export * from './compare';
export * from './evaluate';
export * from './synthesize';
export * from './lint';
export * from './coverage';
export * from './diff';

import { describe,it,expect } from 'vitest';
import { gateStatus,requiredJobs } from '../../../scripts/ci-gate.mjs';
describe('production release gate',() => {
  it('requires every named job to succeed',() => {
    const jobs=requiredJobs.map(name => ({name,conclusion:'success'}));
    expect(gateStatus(jobs)).toBe('passed');
    expect(gateStatus(jobs.slice(0,2))).toBe('waiting');
    expect(gateStatus([{name:'e2e',conclusion:'failure'}])).toBe('failed');
    expect(gateStatus([{name:'e2e',conclusion:'skipped'}])).toBe('failed');
  });
});

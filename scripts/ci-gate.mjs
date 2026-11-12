export const requiredJobs = ['test (22)','test (24)','e2e'];
export function gateStatus(jobs) {
  const required=requiredJobs.map(name => jobs.find(job => job.name === name));
  if (required.some(job => job && ['failure','cancelled','timed_out','skipped','action_required','startup_failure','stale','neutral'].includes(job.conclusion))) return 'failed';
  return required.every(job => job?.conclusion === 'success') ? 'passed' : 'waiting';
}

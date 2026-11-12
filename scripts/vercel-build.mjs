import { spawnSync } from 'node:child_process';
import { gateStatus } from './ci-gate.mjs';

// Production builds must wait for this exact commit's checks. Previews and
// local builds remain independent. Public GitHub reads require no credentials.
if (process.env.VERCEL_ENV === 'production') {
  const sha=process.env.VERCEL_GIT_COMMIT_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Production release requires a verified Git commit SHA.');
  const api='https://api.github.com/repos/yashyegare/F1TrackMetricsLab/actions';
  const read=async url => {
    const response=await fetch(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'F1TrackMetricsLab-release-gate'},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Cannot verify production checks: GitHub ${response.status}`);
    return response.json();
  };
  const deadline=Date.now()+8*60*1000;
  let passed=false;
  while(Date.now()<deadline) {
    const runs=await read(`${api}/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=5&check=${Date.now()}`);
    const run=runs.workflow_runs.find(item => item.head_sha===sha && item.head_branch==='main');
    if (run) {
      const {jobs}=await read(`${api}/runs/${run.id}/jobs?per_page=100&check=${Date.now()}`);
      const status=gateStatus(jobs);
      if (status==='failed') throw new Error('Required checks failed; production release stopped.');
      if (status==='passed') {passed=true;break;}
    }
    console.log('Waiting for exact-commit tests, audit, typecheck and browser checks…');
    await new Promise(resolve => setTimeout(resolve,20000));
  }
  if (!passed) throw new Error('Production checks did not complete before the release deadline.');
}
const result=spawnSync('npm',['run','build'],{stdio:'inherit',shell:process.platform==='win32'});
process.exit(result.status ?? 1);

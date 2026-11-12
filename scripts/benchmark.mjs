import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { projectTelemetry } from '../src/utils/telemetryProject.js';
const circuit=JSON.parse(fs.readFileSync(new URL('../src/data/circuits.json',import.meta.url)))[0];
const telemetry=circuit.coordinates.map(([x,y],i) => ({x:x*1000,y:y*1000,date:new Date(1700000000000+i*200).toISOString(),speed:150,throttle:80,brake:0,gear:5,drs:0}));
const runs=[];
for(let i=0;i<12;i++) {const start=performance.now();projectTelemetry(circuit.coordinates,telemetry);if(i>=2)runs.push(performance.now()-start);}
runs.sort((a,b) => a-b);
console.log(JSON.stringify({fixture:'synthetic Austin outline; not real driving telemetry',samples:telemetry.length,node:process.version,platform:process.platform,runs:runs.length,medianMs:Number(runs[4].toFixed(2)),p95Ms:Number(runs[9].toFixed(2))},null,2));

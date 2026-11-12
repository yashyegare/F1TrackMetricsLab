import { projectTelemetry, binTelemetry } from '../utils/telemetryProject';
self.onmessage = ({data}) => {
  try {
    const {projected} = projectTelemetry(data.coordinates,data.telemetry);
    self.postMessage({projected,binned:binTelemetry(projected,data.coordinates.length)});
  } catch (error) { self.postMessage({error:error.message}); }
};

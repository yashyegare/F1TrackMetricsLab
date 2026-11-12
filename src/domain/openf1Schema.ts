import { z } from 'zod';

const nullableNumber = z.number().finite().nullable().optional();
const dated = { date: z.string().refine(value => Number.isFinite(Date.parse(value)), 'Invalid timestamp') };
const schemas = {
  sessions: z.object({ session_key:z.number().int().positive(), session_type:z.string(), session_name:z.string(), date_start:z.string(), meeting_key:z.number().int().positive() }).passthrough(),
  laps: z.object({ driver_number:z.number().int(), lap_number:z.number().int(), lap_duration:nullableNumber, date_start:z.string().nullable().optional(), is_pit_out_lap:z.boolean().nullable().optional() }).passthrough(),
  drivers: z.object({ driver_number:z.number().int(), full_name:z.string() }).passthrough(),
  location: z.object({ ...dated, x:nullableNumber, y:nullableNumber, z:nullableNumber }).passthrough(),
  car_data: z.object({ ...dated, speed:nullableNumber, throttle:nullableNumber, brake:nullableNumber, drs:nullableNumber, n_gear:nullableNumber, rpm:nullableNumber }).passthrough(),
  stints: z.object({ driver_number:z.number().int(), lap_start:nullableNumber, lap_end:nullableNumber }).passthrough(),
  pit: z.object({ driver_number:z.number().int(), lap_number:nullableNumber }).passthrough(),
  race_control: z.object({ message:z.string() }).passthrough(),
  weather: z.object({ ...dated, air_temperature:nullableNumber }).passthrough(),
  intervals: z.object({ ...dated, driver_number:z.number().int() }).passthrough(),
};
export type Endpoint = keyof typeof schemas;
export type ApiRow = Record<string, unknown>;
export function validateResponse(endpoint:string, payload:unknown): ApiRow[] {
  const schema = schemas[endpoint as Endpoint];
  if (!schema) throw new Error(`Unsupported data endpoint: ${endpoint}`);
  const parsed = z.array(schema).safeParse(payload);
  if (!parsed.success) throw new Error(`Invalid ${endpoint} response. Please retry later.`);
  return parsed.data;
}

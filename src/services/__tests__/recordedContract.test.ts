import {describe,it,expect} from 'vitest';
import sample from './fixtures/openf1-recorded.json';
import {validateResponse} from '../../domain/openf1Schema';
describe('recorded OpenF1 schema contracts',() => {
  it('accepts recorded sessions, drivers and car data',() => {
    for(const endpoint of ['sessions','drivers','car_data'] as const) expect(validateResponse(endpoint,sample[endpoint]).length).toBeGreaterThan(0);
  });
  it('rejects an invalid required timestamp',() => {
    expect(() => validateResponse('car_data',[{date:'not-a-date',speed:100}])).toThrow('Invalid car_data');
  });
});

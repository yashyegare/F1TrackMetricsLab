// OpenF1's documented mapping: 8 means eligible, not activated.
// https://openf1.org/docs/#car-data
export const isDrsOpen = value => [10,12,14].includes(value);

import { diffObjects } from '../../src/utils/diff';

describe('diffObjects', () => {
  it('returns an empty object when nothing changed', () => {
    const before = { a: 1, b: { c: 2 } };
    const after = { a: 1, b: { c: 2 } };

    expect(diffObjects(before, after)).toEqual({});
  });

  it('reports a top-level scalar change by dot path', () => {
    const before = { batteryStatus: 'Original' };
    const after = { batteryStatus: 'Refurbished' };

    expect(diffObjects(before, after)).toEqual({
      batteryStatus: { before: 'Original', after: 'Refurbished' },
    });
  });

  it('reports a nested scalar change with the full dot path', () => {
    const before = { generalInformation: { manufacturerInformation: { manufacturerName: 'Tesla Inc' } } };
    const after = { generalInformation: { manufacturerInformation: { manufacturerName: 'Acme Batteries' } } };

    expect(diffObjects(before, after)).toEqual({
      'generalInformation.manufacturerInformation.manufacturerName': { before: 'Tesla Inc', after: 'Acme Batteries' },
    });
  });

  it('treats arrays as whole leaf values, not diffed element-by-element', () => {
    const before = { criticalRawMaterials: ['Lithium', 'Iron'] };
    const after = { criticalRawMaterials: ['Lithium'] };

    expect(diffObjects(before, after)).toEqual({
      criticalRawMaterials: { before: ['Lithium', 'Iron'], after: ['Lithium'] },
    });
  });

  it('reports a field added or removed between before and after', () => {
    const before: Record<string, unknown> = { a: 1 };
    const after: Record<string, unknown> = { a: 1, b: 2 };

    expect(diffObjects(before, after)).toEqual({ b: { before: undefined, after: 2 } });
  });

  it('only reports fields that actually differ, ignoring unchanged siblings', () => {
    const before = { a: 1, b: 2, c: { d: 3, e: 4 } };
    const after = { a: 1, b: 5, c: { d: 3, e: 6 } };

    expect(diffObjects(before, after)).toEqual({
      b: { before: 2, after: 5 },
      'c.e': { before: 4, after: 6 },
    });
  });
});

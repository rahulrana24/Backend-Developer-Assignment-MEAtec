import { PassportChangeEvent, PassportSnapshot } from '../../src/types/passportEvent';

function samplePassport(overrides: Partial<PassportSnapshot> = {}): PassportSnapshot {
  return {
    _id: '66b1f0c9e1a2b3c4d5e6f7a8',
    data: {
      generalInformation: {
        batteryIdentifier: 'BP-2024-011',
        batteryModel: { id: 'LM3-BAT-2024', modelName: 'GMC WZX1' },
        batteryMass: 450,
        batteryCategory: 'EV',
        batteryStatus: 'Original',
        manufacturingDate: '2024-01-15T00:00:00.000Z',
        manufacturingPlace: 'Gigafactory Nevada',
        warrantyPeriod: '8',
        manufacturerInformation: { manufacturerName: 'Tesla Inc', manufacturerIdentifier: 'TESLA-001' },
      },
      materialComposition: {
        batteryChemistry: 'LiFePO4',
        criticalRawMaterials: ['Lithium', 'Iron'],
        hazardousSubstances: [
          { substanceName: 'Lithium Hexafluorophosphate', chemicalFormula: 'LiPF6', casNumber: '21324-40-3' },
        ],
      },
      carbonFootprint: { totalCarbonFootprint: 850, measurementUnit: 'kg CO2e', methodology: 'Life Cycle Assessment (LCA)' },
    },
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    ...overrides,
  };
}

export function buildCreatedEvent(overrides: Partial<PassportChangeEvent> = {}): PassportChangeEvent {
  return {
    eventType: 'created',
    passportId: '66b1f0c9e1a2b3c4d5e6f7a8',
    actor: { userId: 'admin-1' },
    timestamp: '2024-01-15T10:30:00.000Z',
    passport: samplePassport(),
    changeDescription: null,
    ...overrides,
  };
}

export function buildUpdatedEvent(overrides: Partial<PassportChangeEvent> = {}): PassportChangeEvent {
  return {
    eventType: 'updated',
    passportId: '66b1f0c9e1a2b3c4d5e6f7a8',
    actor: { userId: 'admin-2' },
    timestamp: '2024-02-20T14:00:00.000Z',
    passport: samplePassport({ updatedBy: 'admin-2' }),
    changeDescription: {
      changedFields: ['generalInformation.batteryStatus', 'materialComposition.criticalRawMaterials'],
      changes: {
        'generalInformation.batteryStatus': { before: 'Original', after: 'Refurbished' },
        'materialComposition.criticalRawMaterials': { before: ['Lithium', 'Iron'], after: ['Lithium'] },
      },
    },
    ...overrides,
  };
}

export function buildDeletedEvent(overrides: Partial<PassportChangeEvent> = {}): PassportChangeEvent {
  return {
    eventType: 'deleted',
    passportId: '66b1f0c9e1a2b3c4d5e6f7a8',
    actor: { userId: 'admin-1' },
    timestamp: '2024-03-01T09:00:00.000Z',
    passport: samplePassport(),
    changeDescription: null,
    ...overrides,
  };
}

export function samplePassportBody() {
  return {
    data: {
      generalInformation: {
        batteryIdentifier: 'BP-2024-011',
        batteryModel: { id: 'LM3-BAT-2024', modelName: 'GMC WZX1' },
        batteryMass: 450,
        batteryCategory: 'EV',
        batteryStatus: 'Original',
        manufacturingDate: '2024-01-15',
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
      carbonFootprint: {
        totalCarbonFootprint: 850,
        measurementUnit: 'kg CO2e',
        methodology: 'Life Cycle Assessment (LCA)',
      },
    },
  };
}

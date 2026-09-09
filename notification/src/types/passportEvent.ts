// Consumer-side copy of the contract published by
// passport/src/services/passportEventPublisher.ts. Deliberately loose (lots of
// optional/unknown) since this service has no schema registry or runtime validation
// against the producer — see CLAUDE.md's "schema-drift risk" section.

export type PassportChangeType = 'created' | 'updated' | 'deleted';

export interface FieldChange {
  before: unknown;
  after: unknown;
}

export interface ChangeDescription {
  changedFields: string[];
  changes: Record<string, FieldChange>;
}

export interface PassportChangeEvent {
  eventType: PassportChangeType;
  passportId: string;
  actor: { userId: string };
  timestamp: string;
  passport: PassportSnapshot | null | undefined;
  changeDescription: ChangeDescription | null;
}

export interface BatteryModel {
  id?: string;
  modelName?: string;
}

export interface ManufacturerInformation {
  manufacturerName?: string;
  manufacturerIdentifier?: string;
}

export interface GeneralInformation {
  batteryIdentifier?: string;
  batteryModel?: BatteryModel;
  batteryMass?: number;
  batteryCategory?: string;
  batteryStatus?: string;
  manufacturingDate?: string;
  manufacturingPlace?: string;
  warrantyPeriod?: string;
  manufacturerInformation?: ManufacturerInformation;
  [extra: string]: unknown;
}

export interface HazardousSubstance {
  substanceName?: string;
  chemicalFormula?: string;
  casNumber?: string;
}

export interface MaterialComposition {
  batteryChemistry?: string;
  criticalRawMaterials?: string[];
  hazardousSubstances?: HazardousSubstance[];
}

export interface CarbonFootprint {
  totalCarbonFootprint?: number;
  measurementUnit?: string;
  methodology?: string;
}

export interface PassportSnapshot {
  _id?: string;
  data?: {
    generalInformation?: GeneralInformation;
    materialComposition?: MaterialComposition;
    carbonFootprint?: CarbonFootprint;
  };
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

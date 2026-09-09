import { Schema, model, Document, Types } from 'mongoose';

export interface IBatteryModel {
  id: string;
  modelName: string;
}

export interface IManufacturerInformation {
  manufacturerName: string;
  manufacturerIdentifier: string;
}

export interface IGeneralInformation {
  batteryIdentifier: string;
  batteryModel: IBatteryModel;
  batteryMass: number;
  batteryCategory: string;
  batteryStatus: string;
  manufacturingDate: Date;
  manufacturingPlace: string;
  warrantyPeriod: string;
  manufacturerInformation: IManufacturerInformation;
}

export interface IHazardousSubstance {
  substanceName: string;
  chemicalFormula: string;
  casNumber: string;
}

export interface IMaterialComposition {
  batteryChemistry: string;
  criticalRawMaterials: string[];
  hazardousSubstances: IHazardousSubstance[];
}

export interface ICarbonFootprint {
  totalCarbonFootprint: number;
  measurementUnit: string;
  methodology: string;
}

export interface IPassportData {
  generalInformation: IGeneralInformation;
  materialComposition: IMaterialComposition;
  carbonFootprint: ICarbonFootprint;
}

export interface IPassport extends Document {
  _id: Types.ObjectId;
  data: IPassportData;
  createdBy: string;
  updatedBy: string;
}

const batteryModelSchema = new Schema<IBatteryModel>(
  {
    id: { type: String, required: true },
    modelName: { type: String, required: true },
  },
  { _id: false },
);

const manufacturerInformationSchema = new Schema<IManufacturerInformation>(
  {
    manufacturerName: { type: String, required: true },
    manufacturerIdentifier: { type: String, required: true },
  },
  { _id: false },
);

const generalInformationSchema = new Schema<IGeneralInformation>(
  {
    batteryIdentifier: { type: String, required: true, trim: true },
    batteryModel: { type: batteryModelSchema, required: true },
    batteryMass: { type: Number, required: true },
    batteryCategory: { type: String, required: true },
    batteryStatus: { type: String, required: true },
    manufacturingDate: { type: Date, required: true },
    manufacturingPlace: { type: String, required: true },
    warrantyPeriod: { type: String, required: true },
    manufacturerInformation: { type: manufacturerInformationSchema, required: true },
  },
  { _id: false, strict: false },
);

const hazardousSubstanceSchema = new Schema<IHazardousSubstance>(
  {
    substanceName: { type: String, required: true },
    chemicalFormula: { type: String, required: true },
    casNumber: { type: String, required: true },
  },
  { _id: false },
);

const materialCompositionSchema = new Schema<IMaterialComposition>(
  {
    batteryChemistry: { type: String, required: true },
    criticalRawMaterials: { type: [String], required: true, default: [] },
    hazardousSubstances: { type: [hazardousSubstanceSchema], required: true, default: [] },
  },
  { _id: false, strict: false },
);

const carbonFootprintSchema = new Schema<ICarbonFootprint>(
  {
    totalCarbonFootprint: { type: Number, required: true },
    measurementUnit: { type: String, required: true },
    methodology: { type: String, required: true },
  },
  { _id: false, strict: false },
);

const passportDataSchema = new Schema<IPassportData>(
  {
    generalInformation: { type: generalInformationSchema, required: true },
    materialComposition: { type: materialCompositionSchema, required: true },
    carbonFootprint: { type: carbonFootprintSchema, required: true },
  },
  { _id: false, strict: false },
);

const passportSchema = new Schema<IPassport>(
  {
    data: { type: passportDataSchema, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const Passport = model<IPassport>('Passport', passportSchema);

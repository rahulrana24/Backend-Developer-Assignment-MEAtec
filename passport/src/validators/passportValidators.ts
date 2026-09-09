import { body, param } from 'express-validator';

export const createPassportValidators = [
  body('data').exists().withMessage('data is required').bail().isObject().withMessage('data must be an object'),

  body('data.generalInformation')
    .exists()
    .withMessage('data.generalInformation is required')
    .bail()
    .isObject()
    .withMessage('data.generalInformation must be an object'),
  body('data.generalInformation.batteryIdentifier')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.batteryIdentifier is required'),
  body('data.generalInformation.batteryModel')
    .isObject()
    .withMessage('data.generalInformation.batteryModel is required'),
  body('data.generalInformation.batteryModel.id')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.batteryModel.id is required'),
  body('data.generalInformation.batteryModel.modelName')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.batteryModel.modelName is required'),
  body('data.generalInformation.batteryMass')
    .isNumeric()
    .withMessage('data.generalInformation.batteryMass must be a number'),
  body('data.generalInformation.batteryCategory')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.batteryCategory is required'),
  body('data.generalInformation.batteryStatus')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.batteryStatus is required'),
  body('data.generalInformation.manufacturingDate')
    .isISO8601()
    .withMessage('data.generalInformation.manufacturingDate must be a valid ISO8601 date'),
  body('data.generalInformation.manufacturingPlace')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.manufacturingPlace is required'),
  body('data.generalInformation.warrantyPeriod')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.warrantyPeriod must be a string'),
  body('data.generalInformation.manufacturerInformation')
    .isObject()
    .withMessage('data.generalInformation.manufacturerInformation is required'),
  body('data.generalInformation.manufacturerInformation.manufacturerName')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.manufacturerInformation.manufacturerName is required'),
  body('data.generalInformation.manufacturerInformation.manufacturerIdentifier')
    .isString()
    .notEmpty()
    .withMessage('data.generalInformation.manufacturerInformation.manufacturerIdentifier is required'),

  body('data.materialComposition')
    .exists()
    .withMessage('data.materialComposition is required')
    .bail()
    .isObject()
    .withMessage('data.materialComposition must be an object'),
  body('data.materialComposition.batteryChemistry')
    .isString()
    .notEmpty()
    .withMessage('data.materialComposition.batteryChemistry is required'),
  body('data.materialComposition.criticalRawMaterials')
    .isArray({ min: 1 })
    .withMessage('data.materialComposition.criticalRawMaterials must be a non-empty array'),
  body('data.materialComposition.criticalRawMaterials.*')
    .isString()
    .notEmpty()
    .withMessage('data.materialComposition.criticalRawMaterials entries must be non-empty strings'),
  body('data.materialComposition.hazardousSubstances')
    .isArray()
    .withMessage('data.materialComposition.hazardousSubstances must be an array'),
  body('data.materialComposition.hazardousSubstances.*.substanceName')
    .isString()
    .notEmpty()
    .withMessage('hazardousSubstances[].substanceName is required'),
  body('data.materialComposition.hazardousSubstances.*.chemicalFormula')
    .isString()
    .notEmpty()
    .withMessage('hazardousSubstances[].chemicalFormula is required'),
  body('data.materialComposition.hazardousSubstances.*.casNumber')
    .isString()
    .notEmpty()
    .withMessage('hazardousSubstances[].casNumber is required'),

  body('data.carbonFootprint')
    .exists()
    .withMessage('data.carbonFootprint is required')
    .bail()
    .isObject()
    .withMessage('data.carbonFootprint must be an object'),
  body('data.carbonFootprint.totalCarbonFootprint')
    .isNumeric()
    .withMessage('data.carbonFootprint.totalCarbonFootprint must be a number'),
  body('data.carbonFootprint.measurementUnit')
    .isString()
    .notEmpty()
    .withMessage('data.carbonFootprint.measurementUnit is required'),
  body('data.carbonFootprint.methodology')
    .isString()
    .notEmpty()
    .withMessage('data.carbonFootprint.methodology is required'),
];

export const idParamValidator = [param('id').isMongoId().withMessage('id must be a valid Mongo ObjectId')];

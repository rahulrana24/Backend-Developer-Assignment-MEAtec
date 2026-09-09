/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     BatteryModel:
 *       type: object
 *       required: [id, modelName]
 *       properties:
 *         id:
 *           type: string
 *           example: LM3-BAT-2024
 *         modelName:
 *           type: string
 *           example: GMC WZX1
 *     ManufacturerInformation:
 *       type: object
 *       required: [manufacturerName, manufacturerIdentifier]
 *       properties:
 *         manufacturerName:
 *           type: string
 *           example: Tesla Inc
 *         manufacturerIdentifier:
 *           type: string
 *           example: TESLA-001
 *     GeneralInformation:
 *       type: object
 *       required:
 *         - batteryIdentifier
 *         - batteryModel
 *         - batteryMass
 *         - batteryCategory
 *         - batteryStatus
 *         - manufacturingDate
 *         - manufacturingPlace
 *         - warrantyPeriod
 *         - manufacturerInformation
 *       properties:
 *         batteryIdentifier:
 *           type: string
 *           example: BP-2024-011
 *         batteryModel:
 *           $ref: '#/components/schemas/BatteryModel'
 *         batteryMass:
 *           type: number
 *           example: 450
 *         batteryCategory:
 *           type: string
 *           example: EV
 *         batteryStatus:
 *           type: string
 *           example: Original
 *         manufacturingDate:
 *           type: string
 *           format: date
 *           example: '2024-01-15'
 *         manufacturingPlace:
 *           type: string
 *           example: Gigafactory Nevada
 *         warrantyPeriod:
 *           type: string
 *           description: Warranty period, in years, as a string.
 *           example: '8'
 *         manufacturerInformation:
 *           $ref: '#/components/schemas/ManufacturerInformation'
 *     HazardousSubstance:
 *       type: object
 *       required: [substanceName, chemicalFormula, casNumber]
 *       properties:
 *         substanceName:
 *           type: string
 *           example: Lithium Hexafluorophosphate
 *         chemicalFormula:
 *           type: string
 *           example: LiPF6
 *         casNumber:
 *           type: string
 *           example: 21324-40-3
 *     MaterialComposition:
 *       type: object
 *       required: [batteryChemistry, criticalRawMaterials, hazardousSubstances]
 *       properties:
 *         batteryChemistry:
 *           type: string
 *           example: LiFePO4
 *         criticalRawMaterials:
 *           type: array
 *           items:
 *             type: string
 *           example: [Lithium, Iron]
 *         hazardousSubstances:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/HazardousSubstance'
 *     CarbonFootprint:
 *       type: object
 *       required: [totalCarbonFootprint, measurementUnit, methodology]
 *       properties:
 *         totalCarbonFootprint:
 *           type: number
 *           example: 850
 *         measurementUnit:
 *           type: string
 *           example: kg CO2e
 *         methodology:
 *           type: string
 *           example: Life Cycle Assessment (LCA)
 *     PassportData:
 *       type: object
 *       required: [generalInformation, materialComposition, carbonFootprint]
 *       properties:
 *         generalInformation:
 *           $ref: '#/components/schemas/GeneralInformation'
 *         materialComposition:
 *           $ref: '#/components/schemas/MaterialComposition'
 *         carbonFootprint:
 *           $ref: '#/components/schemas/CarbonFootprint'
 *     PassportRequest:
 *       type: object
 *       required: [data]
 *       properties:
 *         data:
 *           $ref: '#/components/schemas/PassportData'
 *     Passport:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 66b1f0c9e1a2b3c4d5e6f7a8
 *         data:
 *           $ref: '#/components/schemas/PassportData'
 *         createdBy:
 *           type: string
 *         updatedBy:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ApiSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Passport created successfully
 *         data:
 *           type: object
 *     ApiErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Passport not found
 *         data:
 *           nullable: true
 *           type: object
 */

export {};

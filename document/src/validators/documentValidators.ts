import { body, param } from 'express-validator';

export const docIdParamValidator = [param('docId').isMongoId().withMessage('docId must be a valid Mongo ObjectId')];

export const uploadValidators = [
  body('description').optional().isString().withMessage('description must be a string'),
];

export const updateMetadataValidators = [
  body().custom((value: Record<string, unknown>) => {
    if (value.originalName === undefined && value.description === undefined) {
      throw new Error('At least one of originalName or description must be provided');
    }
    return true;
  }),
  body('originalName').optional().isString().notEmpty().withMessage('originalName must be a non-empty string'),
  body('description').optional().isString().withMessage('description must be a string'),
];

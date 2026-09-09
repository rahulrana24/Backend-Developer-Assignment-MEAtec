/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     DocumentRecord:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 66b1f0c9e1a2b3c4d5e6f7a8
 *         originalName:
 *           type: string
 *           example: warranty-certificate.pdf
 *         description:
 *           type: string
 *           nullable: true
 *           example: Signed warranty certificate for BP-2024-011
 *         mimeType:
 *           type: string
 *           example: application/pdf
 *         sizeBytes:
 *           type: number
 *           example: 204800
 *         s3Key:
 *           type: string
 *           example: documents/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d-warranty-certificate.pdf
 *         s3Bucket:
 *           type: string
 *           example: battery-passport-documents
 *         uploadedBy:
 *           type: string
 *         updatedBy:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     DocumentUpdateRequest:
 *       type: object
 *       description: At least one of originalName or description must be provided.
 *       properties:
 *         originalName:
 *           type: string
 *           example: warranty-certificate-signed.pdf
 *         description:
 *           type: string
 *           example: Signed warranty certificate for BP-2024-011
 *     ApiSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Document uploaded successfully
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
 *           example: Document not found
 *         data:
 *           nullable: true
 *           type: object
 */

export {};

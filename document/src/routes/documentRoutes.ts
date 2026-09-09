import { Router } from 'express';
import {
  deleteDocument,
  getDocumentById,
  updateDocumentMetadata,
  uploadDocument,
} from '../controllers/documentController';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../middleware/asyncHandler';
import { authorize, verifyAuth } from '../middleware/rbac';
import { upload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  docIdParamValidator,
  updateMetadataValidators,
  uploadValidators,
} from '../validators/documentValidators';

const router = Router();

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a document (admin or user)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               description:
 *                 type: string
 *                 example: Signed warranty certificate for BP-2024-011
 *     responses:
 *       201:
 *         description: Document uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Missing file or validation failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Missing, malformed, or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       503:
 *         description: Auth Service or storage service unreachable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post(
  '/upload',
  verifyAuth,
  authorize(ROLES.ADMIN, ROLES.USER),
  upload.single('file'),
  uploadValidators,
  validate,
  asyncHandler(uploadDocument),
);

/**
 * @swagger
 * /api/documents/{docId}:
 *   get:
 *     summary: Get a downloadable link for a document (owner or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the document
 *     responses:
 *       200:
 *         description: Presigned download link generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Malformed docId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Missing, malformed, or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Caller is neither the uploader nor an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       503:
 *         description: Auth Service or storage service unreachable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get(
  '/:docId',
  verifyAuth,
  authorize(ROLES.ADMIN, ROLES.USER),
  docIdParamValidator,
  validate,
  asyncHandler(getDocumentById),
);

/**
 * @swagger
 * /api/documents/{docId}:
 *   put:
 *     summary: Update a document's metadata (owner or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the document
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentUpdateRequest'
 *     responses:
 *       200:
 *         description: Metadata updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Validation failure or malformed docId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Missing, malformed, or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Caller is neither the uploader nor an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       503:
 *         description: Auth Service unreachable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.put(
  '/:docId',
  verifyAuth,
  authorize(ROLES.ADMIN, ROLES.USER),
  docIdParamValidator,
  updateMetadataValidators,
  validate,
  asyncHandler(updateDocumentMetadata),
);

/**
 * @swagger
 * /api/documents/{docId}:
 *   delete:
 *     summary: Delete a document (owner or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the document
 *     responses:
 *       200:
 *         description: Document deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Malformed docId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Missing, malformed, or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Caller is neither the uploader nor an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       503:
 *         description: Auth Service or storage service unreachable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.delete(
  '/:docId',
  verifyAuth,
  authorize(ROLES.ADMIN, ROLES.USER),
  docIdParamValidator,
  validate,
  asyncHandler(deleteDocument),
);

export default router;

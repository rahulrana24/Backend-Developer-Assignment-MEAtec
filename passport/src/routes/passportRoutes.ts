import { Router } from 'express';
import { createPassport, deletePassport, getPassportById, updatePassport } from '../controllers/passportController';
import { asyncHandler } from '../middleware/asyncHandler';
import { authorize, verifyAuth } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { ROLES } from '../constants/roles';
import { createPassportValidators, idParamValidator } from '../validators/passportValidators';

const router = Router();

/**
 * @swagger
 * /api/passports:
 *   post:
 *     summary: Create a battery passport (admin only)
 *     tags: [Passports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PassportRequest'
 *     responses:
 *       201:
 *         description: Passport created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Validation failure
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
 *         description: Caller is not an admin
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
router.post('/', verifyAuth, authorize(ROLES.ADMIN), createPassportValidators, validate, asyncHandler(createPassport));

/**
 * @swagger
 * /api/passports/{id}:
 *   get:
 *     summary: Retrieve a battery passport by id (admin or user)
 *     tags: [Passports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the passport
 *     responses:
 *       200:
 *         description: Passport found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Malformed id
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
 *       404:
 *         description: Passport not found
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
router.get('/:id', verifyAuth, authorize(ROLES.ADMIN, ROLES.USER), idParamValidator, validate, asyncHandler(getPassportById));

/**
 * @swagger
 * /api/passports/{id}:
 *   put:
 *     summary: Replace a battery passport's data (admin only)
 *     tags: [Passports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the passport
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PassportRequest'
 *     responses:
 *       200:
 *         description: Passport updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Validation failure or malformed id
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
 *         description: Caller is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Passport not found
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
  '/:id',
  verifyAuth,
  authorize(ROLES.ADMIN),
  idParamValidator,
  createPassportValidators,
  validate,
  asyncHandler(updatePassport),
);

/**
 * @swagger
 * /api/passports/{id}:
 *   delete:
 *     summary: Delete a battery passport (admin only)
 *     tags: [Passports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the passport
 *     responses:
 *       200:
 *         description: Passport deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Malformed id
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
 *         description: Caller is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Passport not found
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
router.delete('/:id', verifyAuth, authorize(ROLES.ADMIN), idParamValidator, validate, asyncHandler(deletePassport));

export default router;

import { Router } from 'express';
import { login, register, verify } from '../controllers/authController';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { loginValidators, registerValidators } from '../validators/authValidators';

const router = Router();

router.post('/register', registerValidators, validate, asyncHandler(register));
router.post('/login', loginValidators, validate, asyncHandler(login));
router.post('/verify', authenticate, asyncHandler(verify));

export default router;

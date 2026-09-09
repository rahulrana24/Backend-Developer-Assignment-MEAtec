import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { signToken } from '../utils/jwt';

function getSaltRounds(): number {
  const raw = process.env.BCRYPT_SALT_ROUNDS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 10;
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, role } = req.body as { email: string; password: string; role: string };

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, getSaltRounds());
  const user = await User.create({ email, passwordHash, role });

  sendSuccess(res, 201, 'User registered successfully', {
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  sendSuccess(res, 200, 'Login successful', {
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
  });
}

export async function verify(req: Request, res: Response): Promise<void> {
  // `authenticate` middleware has already verified the token and populated req.user.
  const { userId, email, role } = req.user!;
  sendSuccess(res, 200, 'Token verified successfully', { userId, email, role });
}

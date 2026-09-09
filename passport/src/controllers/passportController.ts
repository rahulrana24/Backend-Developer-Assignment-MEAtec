import { Request, Response } from 'express';
import { IPassportData, Passport } from '../models/Passport';
import { buildChangeDescription, publishPassportChangeEvent } from '../services/passportEventPublisher';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';

export async function createPassport(req: Request, res: Response): Promise<void> {
  const { data } = req.body as { data: IPassportData };
  const passport = await Passport.create({
    data,
    createdBy: req.user!.userId,
    updatedBy: req.user!.userId,
  });

  await publishPassportChangeEvent({
    eventType: 'created',
    passportId: passport._id.toString(),
    actor: { userId: req.user!.userId },
    timestamp: new Date().toISOString(),
    passport: passport.toObject(),
    changeDescription: null,
  });

  sendSuccess(res, 201, 'Passport created successfully', { passport });
}

export async function getPassportById(req: Request, res: Response): Promise<void> {
  const passport = await Passport.findById(req.params.id);
  if (!passport) {
    throw new AppError('Passport not found', 404);
  }

  sendSuccess(res, 200, 'Passport retrieved successfully', { passport });
}

export async function updatePassport(req: Request, res: Response): Promise<void> {
  const { data } = req.body as { data: IPassportData };

  const passport = await Passport.findById(req.params.id);
  if (!passport) {
    throw new AppError('Passport not found', 404);
  }

  const beforeData = passport.toObject().data;
  passport.data = data;
  passport.updatedBy = req.user!.userId;
  await passport.save();

  const changeDescription = buildChangeDescription(beforeData, passport.toObject().data);

  await publishPassportChangeEvent({
    eventType: 'updated',
    passportId: passport._id.toString(),
    actor: { userId: req.user!.userId },
    timestamp: new Date().toISOString(),
    passport: passport.toObject(),
    changeDescription,
  });

  sendSuccess(res, 200, 'Passport updated successfully', { passport });
}

export async function deletePassport(req: Request, res: Response): Promise<void> {
  const passport = await Passport.findByIdAndDelete(req.params.id);
  if (!passport) {
    throw new AppError('Passport not found', 404);
  }

  await publishPassportChangeEvent({
    eventType: 'deleted',
    passportId: passport._id.toString(),
    actor: { userId: req.user!.userId },
    timestamp: new Date().toISOString(),
    passport: passport.toObject(),
    changeDescription: null,
  });

  sendSuccess(res, 200, 'Passport deleted successfully', null);
}

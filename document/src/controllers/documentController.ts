import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { ROLES } from '../constants/roles';
import { DocumentModel, IDocument } from '../models/Document';
import { S3_BUCKET } from '../config/s3';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { deleteFromS3, getPresignedDownloadUrl, PRESIGNED_URL_EXPIRY_SECONDS, uploadToS3 } from '../utils/s3Storage';

// Only the uploader or an admin may read, update, or delete a document's metadata —
// a caller must not be able to enumerate another user's document ids to reach their files.
function assertOwnerOrAdmin(document: Pick<IDocument, 'uploadedBy'>, req: Request): void {
  if (req.user!.role !== ROLES.ADMIN && document.uploadedBy !== req.user!.userId) {
    throw new AppError('You do not have permission to access this document', 403);
  }
}

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new AppError('file is required', 400);
  }

  const key = `documents/${randomUUID()}-${req.file.originalname}`;
  await uploadToS3(key, req.file.buffer, req.file.mimetype);

  const document = await DocumentModel.create({
    originalName: req.file.originalname,
    description: req.body.description,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    s3Key: key,
    s3Bucket: S3_BUCKET,
    uploadedBy: req.user!.userId,
    updatedBy: req.user!.userId,
  });

  sendSuccess(res, 201, 'Document uploaded successfully', { document });
}

export async function getDocumentById(req: Request, res: Response): Promise<void> {
  const document = await DocumentModel.findById(req.params.docId);
  if (!document) {
    throw new AppError('Document not found', 404);
  }
  assertOwnerOrAdmin(document, req);

  const downloadUrl = await getPresignedDownloadUrl(document.s3Key);

  sendSuccess(res, 200, 'Document download link generated successfully', {
    document,
    downloadUrl,
    expiresInSeconds: PRESIGNED_URL_EXPIRY_SECONDS,
  });
}

export async function updateDocumentMetadata(req: Request, res: Response): Promise<void> {
  const document = await DocumentModel.findById(req.params.docId);
  if (!document) {
    throw new AppError('Document not found', 404);
  }
  assertOwnerOrAdmin(document, req);

  if (req.body.originalName !== undefined) {
    document.originalName = req.body.originalName;
  }
  if (req.body.description !== undefined) {
    document.description = req.body.description;
  }
  document.updatedBy = req.user!.userId;
  await document.save();

  sendSuccess(res, 200, 'Document metadata updated successfully', { document });
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const document = await DocumentModel.findById(req.params.docId);
  if (!document) {
    throw new AppError('Document not found', 404);
  }
  assertOwnerOrAdmin(document, req);

  await deleteFromS3(document.s3Key);
  await document.deleteOne();

  sendSuccess(res, 200, 'Document deleted successfully', null);
}

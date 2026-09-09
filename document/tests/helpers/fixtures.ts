import { DocumentModel, IDocument } from '../../src/models/Document';

interface DocumentOverrides {
  originalName?: string;
  description?: string;
  mimeType?: string;
  sizeBytes?: number;
  s3Key?: string;
}

export async function createSampleDocument(uploadedBy: string, overrides: DocumentOverrides = {}): Promise<IDocument> {
  return DocumentModel.create({
    originalName: overrides.originalName ?? 'warranty.pdf',
    description: overrides.description,
    mimeType: overrides.mimeType ?? 'application/pdf',
    sizeBytes: overrides.sizeBytes ?? 1024,
    s3Key: overrides.s3Key ?? `documents/${uploadedBy}-${overrides.originalName ?? 'warranty.pdf'}`,
    s3Bucket: 'test-bucket',
    uploadedBy,
    updatedBy: uploadedBy,
  });
}

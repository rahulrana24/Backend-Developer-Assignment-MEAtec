import { Document as MongooseDocument, Schema, Types, model } from 'mongoose';

export interface IDocument extends MongooseDocument {
  _id: Types.ObjectId;
  originalName: string;
  description?: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  s3Bucket: string;
  uploadedBy: string;
  updatedBy: string;
}

const documentSchema = new Schema<IDocument>(
  {
    originalName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    s3Key: { type: String, required: true, unique: true },
    s3Bucket: { type: String, required: true },
    uploadedBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const DocumentModel = model<IDocument>('Document', documentSchema);

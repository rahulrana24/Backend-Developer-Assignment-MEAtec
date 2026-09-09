import path from 'path';
import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Document Service API',
      version: '1.0.0',
      description:
        'Document upload, metadata, and download-link microservice backed by S3-compatible storage. Identity is verified by delegating to the Auth Service over HTTP — every endpoint requires a Bearer JWT issued by the Auth Service.',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../config/swaggerSchemas.ts'),
    path.join(__dirname, '../config/swaggerSchemas.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export function mountSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

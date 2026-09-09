import path from 'path';
import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Passport Service API',
      version: '1.0.0',
      description:
        'Battery Passport CRUD microservice. Identity is verified by delegating to the Auth Service over HTTP — every protected endpoint requires a Bearer JWT issued by the Auth Service.',
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

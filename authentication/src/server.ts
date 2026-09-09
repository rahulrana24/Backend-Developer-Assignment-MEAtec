import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT ?? 4000;
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/auth-service';

async function main(): Promise<void> {
  await connectDB(MONGO_URI);
  console.log('Connected to MongoDB');

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Auth service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start auth service', err);
  process.exit(1);
});

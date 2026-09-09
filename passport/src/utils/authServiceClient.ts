import axios from 'axios';

export const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:4000';
const TIMEOUT_MS = Number(process.env.AUTH_VERIFY_TIMEOUT_MS ?? 5000);

export const authServiceClient = axios.create({
  baseURL: AUTH_SERVICE_URL,
  timeout: TIMEOUT_MS,
});

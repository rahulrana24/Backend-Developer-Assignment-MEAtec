import nock from 'nock';
import { AUTH_SERVICE_URL } from '../../src/utils/authServiceClient';

interface MockUserOverrides {
  userId?: string;
  email?: string;
}

export function mockAuthVerifySuccess(role: 'admin' | 'user', overrides: MockUserOverrides = {}): nock.Scope {
  return nock(AUTH_SERVICE_URL)
    .post('/api/auth/verify')
    .reply(200, {
      success: true,
      message: 'Token verified successfully',
      data: {
        userId: overrides.userId ?? 'user-id-1',
        email: overrides.email ?? 'someone@example.com',
        role,
      },
    });
}

export function mockAuthVerifyUnauthorized(message = 'Invalid or expired token'): nock.Scope {
  return nock(AUTH_SERVICE_URL).post('/api/auth/verify').reply(401, { success: false, message, data: null });
}

export function mockAuthVerifyNetworkError(): nock.Scope {
  return nock(AUTH_SERVICE_URL)
    .post('/api/auth/verify')
    .replyWithError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });
}

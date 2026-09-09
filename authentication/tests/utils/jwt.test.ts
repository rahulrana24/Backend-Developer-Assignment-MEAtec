import { signToken, verifyToken } from '../../src/utils/jwt';

describe('jwt utils', () => {
  const payload = { userId: 'abc123', email: 'user@example.com', role: 'user' as const };

  it('signs a token that verifyToken can decode back to the original payload', () => {
    const token = signToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('throws when verifying a tampered token', () => {
    const token = signToken(payload);
    const tampered = token.slice(0, -2) + 'zz';

    expect(() => verifyToken(tampered)).toThrow();
  });
});

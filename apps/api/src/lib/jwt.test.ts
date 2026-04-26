import jwt from 'jsonwebtoken';

const SECRET = 'a'.repeat(32);
const PAYLOAD = { sub: 'user-uuid', tenantId: 'tenant-uuid' };

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe('signToken', () => {
  it('returns a three-part JWT string', async () => {
    const { signToken } = await import('./jwt.js');
    const token = signToken(PAYLOAD);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('embeds sub and tenantId in the payload', async () => {
    const { signToken, verifyToken } = await import('./jwt.js');
    const token = signToken(PAYLOAD);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(PAYLOAD.sub);
    expect(decoded.tenantId).toBe(PAYLOAD.tenantId);
  });

  it('sets expiry 7 days from iat', async () => {
    const { signToken, verifyToken } = await import('./jwt.js');
    const before = Math.floor(Date.now() / 1000);
    const token = signToken(PAYLOAD);
    const { exp, iat } = verifyToken(token);
    expect(exp! - iat!).toBe(7 * 24 * 60 * 60);
    expect(iat).toBeGreaterThanOrEqual(before);
  });
});

describe('verifyToken', () => {
  it('throws on a tampered token', async () => {
    const { signToken, verifyToken } = await import('./jwt.js');
    const token = signToken(PAYLOAD);
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('throws on an expired token', async () => {
    const { verifyToken } = await import('./jwt.js');
    const expired = jwt.sign(PAYLOAD, SECRET, { expiresIn: -1 });
    expect(() => verifyToken(expired)).toThrow();
  });

  it('throws on a token signed with a different secret', async () => {
    const { verifyToken } = await import('./jwt.js');
    const other = jwt.sign(PAYLOAD, 'b'.repeat(32));
    expect(() => verifyToken(other)).toThrow();
  });
});

describe('startup guard', () => {
  it('throws when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    const { assertJwtSecret } = await import('./jwt.js');
    expect(() => assertJwtSecret()).toThrow(/JWT_SECRET/);
  });
});

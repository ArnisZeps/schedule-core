import { hashPassword, verifyPassword } from './password.js';

// bcrypt factor 12 is intentionally slow (~1s/call) — each test has extended timeout
const T = 15_000;

describe('hashPassword', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
  }, T);

  it('produces a different hash each call (salt)', async () => {
    const a = await hashPassword('secret123');
    const b = await hashPassword('secret123');
    expect(a).not.toBe(b);
  }, T);

  it('never contains the plaintext password', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toContain('secret123');
  }, T);
});

describe('verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('correct-horse', hash)).toBe(true);
  }, T);

  it('returns false for a wrong password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  }, T);

  it('returns false for an empty string', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('', hash)).toBe(false);
  }, T);
});

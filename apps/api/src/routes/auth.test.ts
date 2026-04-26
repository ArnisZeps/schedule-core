import request from 'supertest';
import { createDb, type Db } from '@schedule-core/db';
import { app } from '../app.js';

// Integration tests — require a real Neon test branch via TEST_DATABASE_URL
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');

let pool: Db;

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  pool = createDb();
  // Wipe auth-related rows before suite
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM tenants');
});

afterAll(async () => {
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM tenants');
  await pool.end();
  delete process.env.JWT_SECRET;
});

// ---------------------------------------------------------------------------
// POST /auth/signup
// ---------------------------------------------------------------------------

describe('POST /auth/signup', () => {
  const valid = {
    email: 'owner@example.com',
    password: 'password123',
    businessName: 'Test Barber',
    slug: 'test-barber',
  };

  it('201 — creates tenant + user, returns a JWT', async () => {
    const res = await request(app).post('/auth/signup').send(valid);

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.')).toHaveLength(3);
  }, 15_000);

  it('409 email_taken — duplicate email', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ ...valid, slug: 'test-barber-2' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'email_taken' });
  }, 15_000);

  it('409 slug_taken — duplicate slug', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ ...valid, email: 'other@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'slug_taken' });
  }, 15_000);

  it('422 slug_reserved — reserved slug', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ ...valid, email: 'new@example.com', slug: 'admin' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'validation_error',
      details: ['slug_reserved'],
    });
  }, 15_000);

  it('422 validation_error — missing required fields', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'bad@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
    expect(Array.isArray(res.body.details)).toBe(true);
  }, 15_000);

  it('422 validation_error — password too short', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ ...valid, email: 'short@example.com', slug: 'short-pw', password: '1234567' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

describe('POST /auth/login', () => {
  it('200 — returns a JWT for correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  }, 15_000);

  it('401 — wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
  }, 15_000);

  it('401 — unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
  }, 15_000);
});

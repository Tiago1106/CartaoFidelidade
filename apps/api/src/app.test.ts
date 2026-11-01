import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorStatus, type ErrorCode } from './errors/app-error';
import { errorMessages } from './messages/pt-BR';
import { createTestApp, type TestApp } from './test/test-app';

let t: TestApp;
const http = () => request(t.app.getHttpServer());

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.app.close();
});

describe('GET /health', () => {
  it('answers ok with the time of the clock', async () => {
    const response = await http().get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', time: '2026-11-01T12:00:00.000Z' });
  });

  it('golden rule 6: the time comes from the injected clock', async () => {
    t.clock.advanceSeconds(3600);
    const response = await http().get('/health');
    expect(response.body.time).toBe('2026-11-01T13:00:00.000Z');
    t.clock.advanceSeconds(-3600);
  });
});

describe('request id', () => {
  it('returns X-Request-Id on every response', async () => {
    const response = await http().get('/health');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not trust an id sent by the caller', async () => {
    const response = await http().get('/health').set('X-Request-Id', 'evil-id');
    expect(response.headers['x-request-id']).not.toContain('evil');
  });

  it('repeats the id in the body of an error', async () => {
    const response = await http().get('/v1/test/error/NOT_FOUND');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('error format (docs/API.md section 1)', () => {
  const codes = Object.keys(errorStatus).filter((code) => code !== 'INTERNAL_ERROR') as ErrorCode[];

  it.each(codes)('%s answers with its HTTP status, code and Portuguese message', async (code) => {
    const response = await http().get(`/v1/test/error/${code}`);
    expect(response.status).toBe(errorStatus[code]);
    expect(response.body).toEqual({
      error: { code, message: errorMessages[code], requestId: response.headers['x-request-id'] },
    });
  });

  it('keeps the message and the details that a rule gives', async () => {
    const response = await http().get('/v1/test/custom-message');
    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'STAMP_TOO_SOON',
      message: 'A próxima visita só pode ser registrada às 15:40.',
      details: { nextAllowedAt: '2026-10-26T18:40:00Z' },
    });
  });

  it('RATE_LIMITED sends Retry-After', async () => {
    const response = await http().get('/v1/test/limited');
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('42');
  });

  it('NOT_FOUND for a route that does not exist', async () => {
    const response = await http().get('/v1/nothing-here');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('INTERNAL_ERROR hides what went wrong', async () => {
    const response = await http().get('/v1/test/crash');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });
});

describe('VALIDATION_ERROR', () => {
  it('lists the wrong fields and does not echo the values', async () => {
    const response = await http().post('/v1/test/validate').send({ name: '', age: 'secret-text' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const fields = response.body.error.details.fields.map((f: { field: string }) => f.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'age']));
    expect(JSON.stringify(response.body)).not.toContain('secret-text');
  });

  it('passes a valid body through', async () => {
    const response = await http().post('/v1/test/validate').send({ name: 'Maria', age: 30 });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'Maria', age: 30 });
  });
});

describe('logs', () => {
  it('golden rule 8: logs the path without the query, so a phone in it is not written', async () => {
    await http().get('/health?phone=%2B5511900000000');
    const text = t.logLines.join('');
    expect(text).toContain('"path":"/health"');
    expect(text).not.toContain('5511900000000');
  });

  it('writes an unexpected error to the log, with its request id', async () => {
    t.logLines.length = 0;
    const response = await http().get('/v1/test/crash');
    const errorLine = t.logLines.find((line) => line.includes('"errorName"'));
    expect(errorLine).toContain(response.headers['x-request-id']);
  });
});

describe('OpenAPI', () => {
  it('serves the document with the health route', async () => {
    const response = await http().get('/docs-json');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths)).toContain('/health');
  });
});

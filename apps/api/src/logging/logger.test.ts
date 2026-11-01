import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, maskPhone, REDACTED } from './logger';

function capture() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { lines, logger: createLogger({ destination }) };
}

describe('logger', () => {
  it.each(['phone', 'code', 'token', 'refreshToken', 'qrToken', 'password', 'authorization'])(
    'golden rule 8: never writes the value of "%s"',
    (key) => {
      const { lines, logger } = capture();
      logger.info({ [key]: 'secret-value-123' }, 'event');
      expect(lines.join('')).not.toContain('secret-value-123');
      expect(lines.join('')).toContain(REDACTED);
    },
  );

  it('golden rule 8: also hides them one level inside an object', () => {
    const { lines, logger } = capture();
    logger.info({ body: { phone: '+5511900000000', code: '482913' } }, 'event');
    const text = lines.join('');
    expect(text).not.toContain('+5511900000000');
    expect(text).not.toContain('482913');
  });

  it('golden rule 8: hides the authorization header and the cookie of a request', () => {
    const { lines, logger } = capture();
    logger.info(
      { req: { headers: { authorization: 'Bearer abc.def', cookie: 'refresh=zzz' } } },
      'request',
    );
    const text = lines.join('');
    expect(text).not.toContain('abc.def');
    expect(text).not.toContain('refresh=zzz');
  });

  it('keeps ordinary fields', () => {
    const { lines, logger } = capture();
    logger.info({ requestId: 'r-1', status: 200 }, 'done');
    expect(lines.join('')).toContain('"requestId":"r-1"');
  });

  it('masks a phone number to its last four digits', () => {
    expect(maskPhone('+5511900000000')).toBe('+55 ** *****-0000');
    expect(maskPhone('+5521987654321')).not.toContain('98765');
  });
});

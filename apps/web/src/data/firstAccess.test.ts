import { describe, expect, it } from 'vitest';
import { fakeApi } from '@/test/fakeApi';
import { cleanName, NAME_MAX_LENGTH, saveFirstAccessName } from './firstAccess';

describe('cleanName', () => {
  it('removes the spaces around the name and the repeated ones inside it', () => {
    expect(cleanName('  Maria   da  Silva ')).toBe('Maria da Silva');
  });

  it('turns a name of only spaces into an empty one', () => {
    expect(cleanName('   ')).toBe('');
  });
});

describe('saveFirstAccessName', () => {
  it('RN-ENT-07, RN-ENT-08: sends only the clean name and acceptTerms, with the access token', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: false });
    const profile = await saveFirstAccessName('  Maria   da Silva ');
    expect(profile).toMatchObject({ name: 'Maria da Silva', profileComplete: true });
    const call = fake.calls.find((c) => c.method === 'PATCH');
    expect(call).toMatchObject({
      path: '/v1/customer/me',
      body: { name: 'Maria da Silva', acceptTerms: true },
    });
    expect(Object.keys(call!.body as object).sort()).toEqual(['acceptTerms', 'name']);
    expect(call!.authorization).toMatch(/^Bearer access-/);
  });

  it('never sends more than the limit', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: false });
    const { name } = await saveFirstAccessName('a'.repeat(NAME_MAX_LENGTH + 10));
    expect(name).toHaveLength(NAME_MAX_LENGTH);
  });
});

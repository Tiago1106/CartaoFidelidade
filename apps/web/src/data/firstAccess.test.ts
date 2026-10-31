import { describe, expect, it } from 'vitest';
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
  it('saves the clean name', async () => {
    expect(await saveFirstAccessName('  Maria  ')).toEqual({ name: 'Maria' });
  });

  it('never saves more than the limit', async () => {
    const { name } = await saveFirstAccessName('a'.repeat(NAME_MAX_LENGTH + 10));
    expect(name).toHaveLength(NAME_MAX_LENGTH);
  });
});

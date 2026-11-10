import { describe, expect, it } from 'vitest';
import { readInitialGuide } from './guide';

describe('guide entry routing', () => {
  it('opens the two-guide landing unless a guide is requested', () => {
    expect(readInitialGuide('')).toBe('home');
    expect(readInitialGuide('?embedded=1')).toBe('home');
    expect(readInitialGuide('?guide=models')).toBe('models');
    expect(readInitialGuide('?guide=stimuli&embedded=1')).toBe('stimuli');
    expect(readInitialGuide('?guide=other')).toBe('home');
  });
});

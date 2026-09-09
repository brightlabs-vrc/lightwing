import { describe, expect, it } from 'vitest';
import { slugify } from './slugs';

describe('slugify', () => {
  it('converts uppercase letters to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('handles multiple consecutive spaces', () => {
    expect(slugify('Hello   World')).toBe('hello-world');
  });

  it('handles punctuation and special characters', () => {
    expect(slugify('Hello-World!')).toBe('hello-world');
    expect(slugify('Special @#$ Chars')).toBe('special-chars');
  });

  it('strips leading and trailing whitespace', () => {
    expect(slugify('  Hello  World  ')).toBe('hello-world');
  });

  it('removes accent markers and diacritics', () => {
    expect(slugify('Héllô Wörld')).toBe('hello-world');
    expect(slugify('Café Münster')).toBe('cafe-munster');
    expect(slugify('Héllô   Wörld 123')).toBe('hello-world-123');
  });

  it('handles empty strings and strings with only special characters or hyphens', () => {
    expect(slugify('')).toBe('');
    expect(slugify('---')).toBe('');
    expect(slugify('  !@#$%  ')).toBe('');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('---Hello---')).toBe('hello');
  });

  it('replaces underscores and multiple non-alphanumeric characters with a single dash', () => {
    expect(slugify('foo__bar')).toBe('foo-bar');
    expect(slugify('foo...bar')).toBe('foo-bar');
  });

  it('preserves numbers', () => {
    expect(slugify('Hello World 123!')).toBe('hello-world-123');
    expect(slugify('123 456')).toBe('123-456');
  });
});

import { describe, expect, it } from 'vitest';
import { isReservedSlug, isValidSlug, isValidUserSlug, slugify } from './slugs';

describe('isValidSlug', () => {
  describe('valid team slugs', () => {
    it('accepts 3-character simple alphanumeric slug', () => {
      expect(isValidSlug('abc')).toBe(true);
      expect(isValidSlug('123')).toBe(true);
    });

    it('accepts valid hyphens and numbers', () => {
      expect(isValidSlug('abc123')).toBe(true);
      expect(isValidSlug('abc-123')).toBe(true);
      expect(isValidSlug('a-b-c')).toBe(true);
      expect(isValidSlug('team-alpha-1')).toBe(true);
    });

    it('accepts exactly 24-character slug (maximum length)', () => {
      const slug24 = 'a'.repeat(24);
      expect(slug24.length).toBe(24);
      expect(isValidSlug(slug24)).toBe(true);
    });
  });

  describe('length boundaries', () => {
    it('rejects slugs shorter than 3 characters', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug('a')).toBe(false);
      expect(isValidSlug('ab')).toBe(false);
    });

    it('rejects slugs longer than 24 characters', () => {
      const slug25 = 'a'.repeat(25);
      expect(slug25.length).toBe(25);
      expect(isValidSlug(slug25)).toBe(false);

      expect(isValidSlug('hello-world-this-is-a-very-long-slug')).toBe(false);
    });
  });

  describe('format and character constraints', () => {
    it('rejects uppercase characters', () => {
      expect(isValidSlug('ABC')).toBe(false);
      expect(isValidSlug('Abc')).toBe(false);
      expect(isValidSlug('Team-Name')).toBe(false);
    });

    it('rejects leading or trailing hyphens', () => {
      expect(isValidSlug('-abc')).toBe(false);
      expect(isValidSlug('abc-')).toBe(false);
      expect(isValidSlug('-abc-')).toBe(false);
    });

    it('rejects consecutive hyphens', () => {
      expect(isValidSlug('abc--def')).toBe(false);
    });

    it('rejects special characters and spaces', () => {
      expect(isValidSlug('hello!')).toBe(false);
      expect(isValidSlug('team_name')).toBe(false);
      expect(isValidSlug('team name')).toBe(false);
      expect(isValidSlug('hello.world')).toBe(false);
      expect(isValidSlug('slug@domain')).toBe(false);
    });
  });

  describe('reserved slugs', () => {
    it('rejects system reserved slugs', () => {
      const reservedList = [
        'admin',
        'api',
        'events',
        'users',
        'teams',
        'settings',
        'login',
        'auth',
        'profile',
        'onboarding',
        'admin-panel',
        'dashboard',
        'help',
        'support',
        'status',
      ];

      for (const reserved of reservedList) {
        expect(isValidSlug(reserved)).toBe(false);
      }
    });

    it('rejects reserved slugs regardless of case', () => {
      expect(isValidSlug('ADMIN')).toBe(false);
      expect(isValidSlug('Profile')).toBe(false);
    });
  });
});

describe('isReservedSlug', () => {
  it('identifies reserved slugs', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('ADMIN')).toBe(true);
    expect(isReservedSlug('status')).toBe(true);
  });

  it('returns false for non-reserved slugs', () => {
    expect(isReservedSlug('my-team')).toBe(false);
    expect(isReservedSlug('alice')).toBe(false);
    expect(isReservedSlug('hello')).toBe(false);
  });
});

describe('isValidUserSlug', () => {
  it('accepts valid 4-24 character alphanumeric user slugs', () => {
    expect(isValidUserSlug('abcd')).toBe(true);
    expect(isValidUserSlug('user123')).toBe(true);
    expect(isValidUserSlug('a'.repeat(24))).toBe(true);
  });

  it('rejects user slugs under 4 characters or over 24 characters', () => {
    expect(isValidUserSlug('abc')).toBe(false);
    expect(isValidUserSlug('a'.repeat(25))).toBe(false);
  });

  it('rejects hyphens, uppercase, and special chars for user slugs', () => {
    expect(isValidUserSlug('user-slug')).toBe(false);
    expect(isValidUserSlug('User123')).toBe(false);
    expect(isValidUserSlug('user_123')).toBe(false);
  });

  it('rejects reserved slugs for users', () => {
    expect(isValidUserSlug('admin')).toBe(false);
    expect(isValidUserSlug('users')).toBe(false);
  });
});

describe('slugify', () => {
  it('converts strings to URL-friendly slugs', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Hello   World  ')).toBe('hello-world');
    expect(slugify('Héllô Wörld 123')).toBe('hello-world-123');
    expect(slugify('---Hello---')).toBe('hello');
    expect(slugify('foo__bar')).toBe('foo-bar');
    expect(slugify('')).toBe('');
  });
});

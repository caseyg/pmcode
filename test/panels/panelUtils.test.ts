import { describe, it, expect } from 'vitest';
import {
  getNonce,
  escapeHtml,
  statusDotClass,
  statusLabel,
  ConnectorStatus,
} from '../../src/panels/panelUtils';

describe('panelUtils', () => {
  describe('getNonce()', () => {
    it('returns a 32-character string', () => {
      const nonce = getNonce();
      expect(nonce).toHaveLength(32);
    });

    it('returns unique strings on successive calls', () => {
      const nonces = new Set(Array.from({ length: 20 }, () => getNonce()));
      expect(nonces.size).toBe(20);
    });

    it('contains only alphanumeric characters', () => {
      const nonce = getNonce();
      expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('escapeHtml()', () => {
    it('escapes < and >', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes &', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes double quotes', () => {
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('passes through safe strings unchanged', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('escapes all special characters together', () => {
      expect(escapeHtml('<a href="x">&</a>')).toBe(
        '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'
      );
    });
  });

  describe('statusDotClass()', () => {
    const cases: [ConnectorStatus, string][] = [
      ['connected', 'green'],
      ['warning', 'yellow'],
      ['error', 'red'],
      ['disabled', 'muted'],
      ['unconfigured', 'muted'],
    ];

    it.each(cases)('returns "%s" -> "%s"', (status, expected) => {
      expect(statusDotClass(status)).toBe(expected);
    });
  });

  describe('statusLabel()', () => {
    const cases: [ConnectorStatus, string][] = [
      ['connected', 'Connected'],
      ['warning', 'Needs attention'],
      ['error', 'Error'],
      ['disabled', 'Disabled'],
      ['unconfigured', 'Not configured'],
    ];

    it.each(cases)('returns "%s" -> "%s"', (status, expected) => {
      expect(statusLabel(status)).toBe(expected);
    });
  });
});

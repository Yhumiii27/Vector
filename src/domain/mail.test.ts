import { describe, expect, it } from 'vitest';
import { emlOf, headerValue } from './mail';

describe('eml', () => {
  it('encodes non-ASCII headers, never lets a line break into a header, base64 body', () => {
    expect(headerValue('Hello')).toBe('Hello');
    expect(headerValue('Hélène')).toBe(`=?UTF-8?B?${Buffer.from('Hélène').toString('base64')}?=`);
    expect(headerValue('a\r\nBcc: x@y.z')).toBe('a Bcc: x@y.z');
    const eml = emlOf({ id: 'm1', from: 'vector@groupe.example', to: 'h@demo.example', toName: 'Hélène\nBcc: evil@x.y', subject: 'Sujet é', body: 'Ligne 1\nLigne 2', date: new Date('2026-11-24T10:00:00Z') });
    const [head, body] = eml.split('\r\n\r\n');
    expect(head.split('\r\n').every((l) => /^[A-Za-z-]+: /.test(l))).toBe(true);
    expect(head).not.toContain('Bcc:');
    expect(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('Ligne 1\r\nLigne 2');
  });
});

import { describe, it, expect } from 'vitest';
import { decodeImage, sanitizeFilename, countTriangles } from '../../server/commands/stl.js';

describe('decodeImage', () => {
  it('passes through Buffer unchanged', () => {
    const b = Buffer.from([1, 2, 3]);
    expect(decodeImage(b)).toBe(b);
  });

  it('converts Uint8Array to Buffer', () => {
    const u = new Uint8Array([7, 8, 9]);
    const out = decodeImage(u);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.equals(Buffer.from([7, 8, 9]))).toBe(true);
  });

  it('decodes plain base64 strings', () => {
    const b64 = Buffer.from('hello').toString('base64');
    const out = decodeImage(b64);
    expect(out.toString('utf8')).toBe('hello');
  });

  it('decodes data: URI base64 strings', () => {
    const b64 = Buffer.from('data-uri').toString('base64');
    const out = decodeImage(`data:image/png;base64,${b64}`);
    expect(out.toString('utf8')).toBe('data-uri');
  });

  it('rehydrates JSON Buffer wire shape', () => {
    const wire = { type: 'Buffer', data: [1, 2, 3, 4] };
    expect(decodeImage(wire).equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });

  it('throws on unsupported encodings', () => {
    expect(() => decodeImage(42)).toThrow(/unsupported_image_encoding/);
    expect(() => decodeImage(null)).toThrow(/unsupported_image_encoding/);
  });
});

describe('sanitizeFilename', () => {
  it('replaces unsafe characters with underscores', () => {
    expect(sanitizeFilename('../etc/passwd')).toBe('.._etc_passwd');
    expect(sanitizeFilename('my file (1).png')).toBe('my_file__1_.png');
  });

  it('preserves dots, dashes and alphanum', () => {
    expect(sanitizeFilename('photo-2024.test.png')).toBe('photo-2024.test.png');
  });

  it('caps at 120 characters', () => {
    const long = 'a'.repeat(200) + '.png';
    expect(sanitizeFilename(long).length).toBe(120);
  });

  it('returns photo.png for empty input after sanitization', () => {
    expect(sanitizeFilename('')).toBe('photo.png');
    expect(sanitizeFilename('!!!')).toBe('___');
  });
});

describe('countTriangles', () => {
  it('counts ASCII STL facet normals', () => {
    const ascii = 'solid s\n facet normal 0 0 1\n facet normal 0 1 0\n facet normal 1 0 0\nendsolid s';
    expect(countTriangles(Buffer.from(ascii, 'utf8'))).toBe(3);
  });

  it('reads triangle count from binary STL header', () => {
    const buf = Buffer.alloc(84);
    buf.writeUInt32LE(12345, 80);
    expect(countTriangles(buf)).toBe(12345);
  });

  it('returns 0 for too-short binary blobs', () => {
    expect(countTriangles(Buffer.alloc(10))).toBe(0);
  });
});

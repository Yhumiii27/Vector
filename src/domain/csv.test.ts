import { describe, expect, it } from 'vitest';
import { cell, toCsv } from './csv';

describe('CSV', () => {
  it('quotes and neutralises formulas', () => {
    expect(cell('a;b')).toBe('"a;b"');
    expect(cell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(cell(-12.5)).toBe('-12.5');
    expect(toCsv(['x'], [[1]])).toBe('﻿x\r\n1\r\n');
  });
});

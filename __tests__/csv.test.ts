import { csvField, csvRow } from '../utils/csv';

/**
 * Minimal RFC 4180 CSV row parser for testing round-trip serialization.
 */
function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < row.length) {
    if (row[i] === '"') {
      i++; // skip opening quote
      let field = '';
      while (i < row.length) {
        if (row[i] === '"') {
          if (i + 1 < row.length && row[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += row[i];
          i++;
        }
      }
      fields.push(field);
      if (i < row.length && row[i] === ',') {
        i++;
        if (i === row.length) {
          fields.push('');
        }
      }
    } else {
      const commaIdx = row.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(row.slice(i));
        break;
      } else {
        fields.push(row.slice(i, commaIdx));
        i = commaIdx + 1;
        if (i === row.length) {
          fields.push('');
        }
      }
    }
  }
  return fields;
}

describe('csvField', () => {
  it('handles null and undefined as empty string', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('outputs finite numbers as-is without quotes', () => {
    expect(csvField(0)).toBe('0');
    expect(csvField(42)).toBe('42');
    expect(csvField(-12.5)).toBe('-12.5');
    expect(csvField(3.14159)).toBe('3.14159');
  });

  it('outputs non-finite numbers as empty string', () => {
    expect(csvField(NaN)).toBe('');
    expect(csvField(Infinity)).toBe('');
    expect(csvField(-Infinity)).toBe('');
  });

  it('leaves clean strings unquoted', () => {
    expect(csvField('simple')).toBe('simple');
    expect(csvField('Zoë Rider')).toBe('Zoë Rider');
    expect(csvField('Trail 🏇 Blue')).toBe('Trail 🏇 Blue');
  });

  it('wraps strings containing commas in double quotes', () => {
    expect(csvField('Smith, J')).toBe('"Smith, J"');
  });

  it('wraps strings containing double quotes and doubles them', () => {
    expect(csvField('Anna "Ace" Smith')).toBe('"Anna ""Ace"" Smith"');
  });

  it('wraps strings containing newlines and CR', () => {
    expect(csvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    expect(csvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
  });

  it('neutralizes spreadsheet formulas with single quote prefix', () => {
    expect(csvField('=SUM(A1:B1)')).toBe("'=SUM(A1:B1)");
    expect(csvField('@cmd')).toBe("'@cmd");
    expect(csvField('+1+1')).toBe("'+1+1");
    expect(csvField('-2+5')).toBe("'-2+5");
  });

  it('neutralizes formulas containing commas and quotes properly', () => {
    expect(csvField('=SUM(A1, B1)')).toBe('"\'=SUM(A1, B1)"');
    expect(csvField('="malicious"')).toBe('"\'=""malicious"""');
  });

  it('preserves negative numbers and plain numeric strings without neutralizing quote', () => {
    expect(csvField('-12.5')).toBe('-12.5');
    expect(csvField('+3')).toBe('+3');
    expect(csvField('-100')).toBe('-100');
    expect(csvField('+0.75')).toBe('+0.75');
  });

  it('handles very long string names', () => {
    const longName = 'A'.repeat(5000);
    expect(csvField(longName)).toBe(longName);
  });
});

describe('csvRow and round-trip parsing', () => {
  it('joins values with commas', () => {
    expect(csvRow(['A', 'B', 'C'])).toBe('A,B,C');
    expect(csvRow([1, 2, 3])).toBe('1,2,3');
  });

  it('correctly formats rows with mixed types and empties', () => {
    expect(csvRow(['test', null, 42, undefined, NaN])).toBe('test,,42,,');
  });

  it('round-trips awkward inputs cell for cell', () => {
    const testCases: (string | number | null | undefined)[][] = [
      ['Anna "Ace" Smith', 'Smith, J', 'Simple', 42, -12.5],
      ['Unicode: Zoë & 🐴', 'Quotes "inside" and , comma', 'Multi\nLine\r\nText', 0],
      ['', null, undefined, NaN, 'End'],
      ['Long text: ' + 'X'.repeat(500), 'Trailing comma test,', 'Another'],
    ];

    for (const testCase of testCases) {
      const serialized = csvRow(testCase);
      const parsed = parseCsvRow(serialized);

      // Expected values after null/undefined/NaN conversion to empty string
      const expected = testCase.map((v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
        return String(v);
      });

      expect(parsed).toEqual(expected);
    }
  });

  it('neutralizes formula injection while round-tripping safely', () => {
    const formulas = ['=SUM(A1)', '@HYPERLINK("http://evil.com")', '+1+1'];
    const row = csvRow(formulas);
    const parsed = parseCsvRow(row);

    expect(parsed).toEqual(["'=SUM(A1)", '\'@HYPERLINK("http://evil.com")', "'+1+1"]);
  });
});

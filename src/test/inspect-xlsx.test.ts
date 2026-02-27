import { describe, it } from 'vitest';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

describe('inspect xlsx', () => {
  it('reads raw rows', () => {
    const data = fs.readFileSync('public/temp-test-opps.xlsx');
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Get as array of arrays to see raw structure
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    // Print first 5 rows
    for (let i = 0; i < Math.min(5, aoa.length); i++) {
      console.log(`ROW ${i}:`, JSON.stringify(aoa[i]));
    }
    console.log('TOTAL ROWS:', aoa.length);
  });
});

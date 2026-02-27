import { describe, it } from 'vitest';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

describe('inspect xlsx', () => {
  it('reads raw rows', () => {
    const data = fs.readFileSync('public/temp-test-opps.xlsx');
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    for (let i = 4; i < Math.min(10, aoa.length); i++) {
      console.log(`ROW ${i}:`, JSON.stringify(aoa[i]));
    }
  });
});

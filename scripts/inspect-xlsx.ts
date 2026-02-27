import * as XLSX from 'xlsx';
import * as fs from 'fs';

const data = fs.readFileSync('public/temp-test-opps.xlsx');
const workbook = XLSX.read(data, { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

if (json.length > 0) {
  console.log('COLUMNS:', Object.keys(json[0]));
  console.log('FIRST ROW:', JSON.stringify(json[0], null, 2));
} else {
  console.log('Empty sheet');
}

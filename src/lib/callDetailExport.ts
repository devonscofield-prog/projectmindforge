/**
 * Call Detail CSV Export Utility
 * Exports account info, call summary, and products - excludes coaching data
 */

export interface CallExportData {
  accountName: string | null;
  callDate: string;
  callType: string | null;
  stakeholderName: string | null;
  potentialRevenue: number | null;
  salesforceLink: string | null;
  summary: string | null;
  topics: string[] | null;
  products: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function generateCallDetailCSV(data: CallExportData): string {
  const lines: string[] = [];

  // Call Details Section
  lines.push('CALL DETAILS');
  lines.push('Account Name,Call Date,Call Type,Primary Stakeholder,Potential Revenue,Salesforce Link');
  lines.push([
    escapeCSV(data.accountName),
    escapeCSV(formatDate(data.callDate)),
    escapeCSV(data.callType),
    escapeCSV(data.stakeholderName),
    escapeCSV(formatCurrency(data.potentialRevenue)),
    escapeCSV(data.salesforceLink),
  ].join(','));

  lines.push(''); // Empty row separator

  // Summary Section
  lines.push('CALL SUMMARY');
  lines.push(escapeCSV(data.summary || 'No summary available'));

  lines.push(''); // Empty row separator

  // Topics Section
  if (data.topics && data.topics.length > 0) {
    lines.push('TOPICS DISCUSSED');
    lines.push(escapeCSV(data.topics.join(', ')));
    lines.push('');
  }

  // Products Section
  lines.push('PRODUCTS DISCUSSED');
  lines.push('Product Name,Quantity,Unit Price,Total Value');
  
  if (data.products.length > 0) {
    data.products.forEach(product => {
      const total = product.quantity * product.unitPrice;
      lines.push([
        escapeCSV(product.name),
        escapeCSV(product.quantity),
        escapeCSV(formatCurrency(product.unitPrice)),
        escapeCSV(formatCurrency(total)),
      ].join(','));
    });

    // Products total
    const grandTotal = data.products.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0);
    lines.push('');
    lines.push(`Total Products Value,,,${escapeCSV(formatCurrency(grandTotal))}`);
  } else {
    lines.push('No products recorded');
  }

  return lines.join('\n');
}

export function downloadCallDetailCSV(data: CallExportData, filename: string): void {
  const csv = generateCallDetailCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

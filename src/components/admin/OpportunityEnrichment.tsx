import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCSV, generateCSV, downloadCSV } from '@/lib/csvParser';
import { enrichOpportunities } from '@/api/opportunityEnrichment';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  accountNameColumn: string | null;
}

// Standard Salesforce account name column variants
const ACCOUNT_NAME_VARIANTS = [
  'Account Name',
  'AccountName',
  'Account',
  'account_name',
  'account name',
  'ACCOUNT NAME',
  'Company',
  'company',
  'Company Name',
];

function findAccountNameColumn(headers: string[]): string | null {
  for (const variant of ACCOUNT_NAME_VARIANTS) {
    const found = headers.find((h) => h.trim().toLowerCase() === variant.toLowerCase());
    if (found) return found;
  }
  return null;
}

export function OpportunityEnrichment() {
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichedRows, setEnrichedRows] = useState<Record<string, string>[] | null>(null);
  const [enrichedHeaders, setEnrichedHeaders] = useState<string[]>([]);
  const [matchStats, setMatchStats] = useState<{ matched: number; unmatched: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0 || rows.length === 0) {
        toast.error('CSV file appears empty or invalid');
        return;
      }

      const accountNameColumn = findAccountNameColumn(headers);
      if (!accountNameColumn) {
        toast.error('Could not find an "Account Name" column in the CSV. Expected columns: ' + ACCOUNT_NAME_VARIANTS.slice(0, 4).join(', '));
        return;
      }

      setParsedCSV({ headers, rows, accountNameColumn });
      setEnrichedRows(null);
      setEnrichedHeaders([]);
      setMatchStats(null);
      toast.success(`Parsed ${rows.length} opportunities from CSV`);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleEnrich = async () => {
    if (!parsedCSV) return;

    setIsEnriching(true);
    try {
      // Extract unique account names
      const accountNames = [
        ...new Set(
          parsedCSV.rows
            .map((r) => r[parsedCSV.accountNameColumn!])
            .filter(Boolean)
        ),
      ];

      if (accountNames.length === 0) {
        toast.error('No account names found in the CSV');
        return;
      }

      // Call edge function in batches of 100
      const batchSize = 100;
      const allResults: Record<string, Record<string, string>> = {};

      for (let i = 0; i < accountNames.length; i += batchSize) {
        const batch = accountNames.slice(i, i + batchSize);
        const result = await enrichOpportunities(batch);
        Object.assign(allResults, result.results);
      }

      // Merge enrichment into original rows
      const enrichmentKeys = new Set<string>();
      for (const enrichment of Object.values(allResults)) {
        for (const key of Object.keys(enrichment)) {
          enrichmentKeys.add(key);
        }
      }

      const newHeaders = [...parsedCSV.headers, ...Array.from(enrichmentKeys)];
      const newRows = parsedCSV.rows.map((row) => {
        const accountName = (row[parsedCSV.accountNameColumn!] || '').toLowerCase().trim();
        const enrichment = allResults[accountName] || { SW_Match_Status: 'No Match' };
        return { ...row, ...enrichment };
      });

      // Calculate match stats
      let matched = 0;
      let unmatched = 0;
      for (const row of newRows) {
        if (row['SW_Match_Status'] === 'Matched') matched++;
        else unmatched++;
      }

      setEnrichedHeaders(newHeaders);
      setEnrichedRows(newRows);
      setMatchStats({ matched, unmatched });
      toast.success(`Enrichment complete: ${matched} matched, ${unmatched} unmatched`);
    } catch (err) {
      console.error('Enrichment error:', err);
      toast.error(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleDownload = () => {
    if (!enrichedRows || !enrichedHeaders) return;
    const csv = generateCSV(enrichedHeaders, enrichedRows);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `opportunities-enriched-${timestamp}.csv`);
    toast.success('Enriched CSV downloaded');
  };

  const handleReset = () => {
    setParsedCSV(null);
    setEnrichedRows(null);
    setEnrichedHeaders([]);
    setMatchStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      {!parsedCSV && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Upload Salesforce Opportunities CSV
            </CardTitle>
            <CardDescription>
              Upload your standard Salesforce Opportunities export. The tool will match each
              opportunity by Account Name and enrich it with your platform intelligence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse. Standard Salesforce export with "Account Name" column required.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview + Actions */}
      {parsedCSV && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>CSV Preview</CardTitle>
                  <CardDescription>
                    {parsedCSV.rows.length} opportunities found • Matching on column:{' '}
                    <span className="font-medium text-foreground">"{parsedCSV.accountNameColumn}"</span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Upload Different File
                  </Button>
                  {!enrichedRows && (
                    <Button onClick={handleEnrich} disabled={isEnriching}>
                      {isEnriching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enriching...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Enrich & Download
                        </>
                      )}
                    </Button>
                  )}
                  {enrichedRows && (
                    <Button onClick={handleDownload} variant="gradient">
                      <Download className="h-4 w-4 mr-2" />
                      Download Enriched CSV
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isEnriching && (
                <div className="mb-4 space-y-2">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Querying platform data for {parsedCSV.rows.length} opportunities...
                  </p>
                </div>
              )}

              {matchStats && (
                <div className="flex items-center gap-4 mb-4">
                  <Badge variant="default" className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {matchStats.matched} matched
                  </Badge>
                  <Badge variant="secondary" className="gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    {matchStats.unmatched} unmatched
                  </Badge>
                </div>
              )}

              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        {(enrichedHeaders.length > 0 ? enrichedHeaders : parsedCSV.headers)
                          .slice(0, 12)
                          .map((h) => (
                            <TableHead
                              key={h}
                              className={cn(
                                'whitespace-nowrap',
                                h.startsWith('SW_') && 'text-primary font-semibold'
                              )}
                            >
                              {h}
                            </TableHead>
                          ))}
                        {(enrichedHeaders.length > 0 ? enrichedHeaders : parsedCSV.headers).length >
                          12 && <TableHead className="text-muted-foreground">...</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(enrichedRows || parsedCSV.rows).slice(0, 20).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          {(enrichedHeaders.length > 0 ? enrichedHeaders : parsedCSV.headers)
                            .slice(0, 12)
                            .map((h) => (
                              <TableCell
                                key={h}
                                className={cn(
                                  'max-w-[200px] truncate',
                                  h === 'SW_Match_Status' &&
                                    row[h] === 'Matched' &&
                                    'text-green-600 dark:text-green-400 font-medium',
                                  h === 'SW_Match_Status' &&
                                    row[h] === 'No Match' &&
                                    'text-muted-foreground'
                                )}
                              >
                                {row[h] || '—'}
                              </TableCell>
                            ))}
                          {(enrichedHeaders.length > 0 ? enrichedHeaders : parsedCSV.headers)
                            .length > 12 && (
                            <TableCell className="text-muted-foreground">...</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {(enrichedRows || parsedCSV.rows).length > 20 && (
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  Showing first 20 of {(enrichedRows || parsedCSV.rows).length} rows. All rows will
                  be included in the download.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

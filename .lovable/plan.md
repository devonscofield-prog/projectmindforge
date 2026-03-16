

## Plan: Bulk Download All Transcripts as ZIP (CSV index + .txt files)

### What you get
A "Download All Transcripts" button on the admin page that fetches every transcript (paginated past the 1000-row limit), then downloads a single ZIP containing:
1. **`index.csv`** — one row per transcript with columns: rep_name, call_date, account_name, call_type, filename
2. **Individual `.txt` files** — each named `date_account_calltype_rep.txt` (existing naming convention)

A progress toast will show fetch progress since ~1000 transcripts requires multiple batches.

### Changes

1. **`src/lib/transcriptDownload.ts`** — Add a new `downloadAllTranscriptsAsZip()` function that:
   - Fetches all transcripts in paginated batches of 500 using `get_admin_transcripts` RPC (bypasses the 1000-row default limit)
   - Generates the ZIP with an `index.csv` + individual `.txt` files
   - Shows progress via a callback

2. **`src/pages/admin/transcript-analysis/useTranscriptAnalysis.ts`** — Add a `handleDownloadAllTranscripts` function that calls the new bulk download, with toast-based progress feedback

3. **Admin UI (toolbar component)** — Add a "Download All" button next to the existing download button, available regardless of selection state. Will look at the specific toolbar component to place it appropriately.

### Technical details

- **Pagination**: The `get_admin_transcripts` RPC supports `p_limit` and `p_offset`. We'll fetch in batches of 500 until `total_count` is reached.
- **Memory**: ~1000 transcripts with full `raw_text` could be 50-100MB. JSZip handles this in-memory, which is fine for modern browsers. Compression will reduce the final ZIP significantly.
- **RLS**: Uses the existing admin RPC which respects admin role — only admins can access this.
- **No database changes needed.**


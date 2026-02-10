
# Add File Upload Option to SDR Transcript Upload

## What Changes
Update the upload form in `SDRDashboard.tsx` to support two input methods via toggle tabs:
1. **Paste** -- the existing textarea (current behavior)
2. **Upload File** -- a file input that accepts `.txt` files and reads their content

## How It Works
- Add a two-option tab toggle ("Paste Text" / "Upload File") above the input area
- **Paste tab**: Shows the existing textarea (no change)
- **Upload file tab**: Shows a file drop zone / file input accepting `.txt` files. When a file is selected, read it with `FileReader.readAsText()` and populate `rawText` state with the contents
- Both methods feed into the same `rawText` state and `handleUpload()` flow -- zero backend changes needed

## Technical Details

### File: `src/pages/sdr/SDRDashboard.tsx`
- Add `uploadMode` state: `'paste' | 'file'`
- Add `fileName` state to show which file was loaded
- Add a `Tabs` component (from `@radix-ui/react-tabs`, already installed) with two tab triggers
- In the "file" tab, render an `<input type="file" accept=".txt,.text" />` styled as a drop zone
- On file select, use `FileReader` to read the text content into `rawText`
- Show the file name and a preview snippet after loading
- The "Process Transcript" button and date picker remain shared across both modes

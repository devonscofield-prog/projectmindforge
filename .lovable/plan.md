

# Add File Upload to Product Knowledge Base

## Overview

Add the ability for admins to upload documents (PDFs, Word docs, text files) directly to the Product Knowledge Base, in addition to the existing web scraping functionality. These uploaded documents will be processed into chunks with embeddings so the Sales Coach and Sales Assistant can reference them when providing recommendations.

---

## Current System

The Product Knowledge Base currently:
- **Scrapes websites** using Firecrawl to get markdown content
- **Stores content** in `product_knowledge` table (source_url, raw_markdown, title, page_type)
- **Chunks content** into `product_knowledge_chunks` with embeddings for vector search
- **Provides context** to Sales Coach and Sales Assistant via the `find_product_knowledge` function

---

## Implementation Approach

### 1. Create Storage Bucket for Document Uploads

Create a new Supabase storage bucket called `product-documents` for storing uploaded files:

```sql
-- Create storage bucket for product knowledge documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-documents', 'product-documents', false);

-- RLS: Admins can upload/manage files
CREATE POLICY "Admins can manage product documents"
ON storage.objects
FOR ALL
USING (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::user_role));
```

### 2. Extend `product_knowledge` Table

Add a column to distinguish between scraped and uploaded content:

```sql
ALTER TABLE public.product_knowledge 
ADD COLUMN source_type TEXT DEFAULT 'scraped' CHECK (source_type IN ('scraped', 'uploaded'));

-- source_url will store the storage file path for uploads: storage://product-documents/filename.pdf
```

### 3. Create Edge Function: `upload-product-knowledge`

A new edge function that:
1. Accepts file uploads (PDF, DOCX, TXT, MD)
2. Stores the file in Supabase storage
3. Extracts text content using appropriate parsers
4. Saves to `product_knowledge` table with `source_type = 'uploaded'`
5. Triggers the existing `process-product-knowledge` function for chunking/embedding

**Supported file types:**
- **PDF**: Extract text using a PDF parsing library
- **TXT/MD**: Direct text content
- **DOCX**: Extract using mammoth or similar

### 4. Update Admin Knowledge Base UI

Add an "Upload Documents" section to `AdminKnowledgeBase.tsx`:

```
┌─────────────────────────────────────────────────────────┐
│  📤 Upload Documents                                     │
│  ─────────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Drop files here or click to browse             │    │
│  │  Supported: PDF, DOCX, TXT, MD                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  [Document Title: ______________]                        │
│  [Page Type: ▼ Product / Feature / Pricing / Docs ]     │
│                                                          │
│  [Upload Document]                                       │
└─────────────────────────────────────────────────────────┘
```

### 5. Update Stats & Pages Table

- Add filter/badge to distinguish "Scraped" vs "Uploaded" sources
- Show file icon for uploaded documents vs globe icon for scraped pages

---

## Technical Details

### Database Changes

| Change | Description |
|--------|-------------|
| Add `source_type` column | Distinguishes scraped vs uploaded content |
| Create storage bucket | Secure storage for uploaded files |
| Storage RLS policies | Admins only can upload/manage |

### New Edge Function: `upload-product-knowledge`

```typescript
// Accepts: FormData with file + metadata (title, page_type)
// 1. Upload file to storage bucket
// 2. Extract text based on file type:
//    - PDF: pdf-parse or similar
//    - DOCX: mammoth  
//    - TXT/MD: direct read
// 3. Insert into product_knowledge with source_type = 'uploaded'
// 4. Trigger process-product-knowledge for chunking
```

### API Changes

Add new functions to `src/api/productKnowledge.ts`:

```typescript
export async function uploadProductDocument(
  file: File,
  metadata: { title: string; pageType: string }
): Promise<{ success: boolean; id?: string; error?: string }>
```

### UI Components

| Component | Changes |
|-----------|---------|
| `AdminKnowledgeBase.tsx` | Add upload dialog, file drop zone, title/type inputs |
| Status badges | Show "Uploaded" vs "Scraped" badges |
| Table display | File icon for uploads, view/download link for original file |

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/upload-product-knowledge/index.ts` | Edge function to handle file uploads and text extraction |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/AdminKnowledgeBase.tsx` | Add upload dialog, file drop zone, distinguish source types in table |
| `src/api/productKnowledge.ts` | Add `uploadProductDocument()` function |
| Database migration | Add `source_type` column, create storage bucket with RLS |

---

## User Flow

1. **Admin navigates** to `/admin/knowledge-base`
2. **Clicks "Upload Document"** button (new, alongside "Scrape Website")
3. **Selects or drops file** (PDF, DOCX, TXT, MD)
4. **Enters title and page type** in the dialog
5. **Clicks "Upload"** → file is stored, text extracted, and processing begins
6. **Document appears** in the table with "Uploaded" badge
7. **After processing** → chunks with embeddings are available for RAG search
8. **Sales Coach & Assistant** can now reference the uploaded content

---

## Result

1. **Flexible content sources** - Both web scraping AND manual document uploads
2. **Support for common formats** - PDF, Word docs, plain text files
3. **Same RAG pipeline** - Uploaded docs go through identical chunking/embedding process
4. **Unified search** - `find_product_knowledge` returns both scraped and uploaded content seamlessly
5. **Admin control** - Easy to manage, delete, or replace uploaded documents


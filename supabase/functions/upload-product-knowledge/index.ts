import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UploadResponse {
  success: boolean;
  id?: string;
  message?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header for user verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const pageType = formData.get("page_type") as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileName = file.name;
    const fileExt = fileName.split(".").pop()?.toLowerCase();
    const supportedTypes = ["pdf", "docx", "txt", "md"];

    if (!fileExt || !supportedTypes.includes(fileExt)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Unsupported file type. Supported: ${supportedTypes.join(", ")}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${timestamp}-${sanitizedName}`;

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("product-documents")
      .upload(storagePath, uint8Array, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-product-knowledge] Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract text content based on file type
    let extractedText = "";
    let extractionMethod = "";

    try {
      if (fileExt === "txt" || fileExt === "md") {
        // Plain text - decode directly
        const decoder = new TextDecoder("utf-8");
        extractedText = decoder.decode(uint8Array);
        extractionMethod = "plain_text";
      } else if (fileExt === "pdf") {
        // For PDF, use pdf-parse via external service or simple extraction
        // Using a basic approach - extract readable text from PDF bytes
        extractedText = await extractPdfText(uint8Array);
        extractionMethod = "pdf_extraction";
      } else if (fileExt === "docx") {
        // For DOCX, extract text from the XML structure
        extractedText = await extractDocxText(uint8Array);
        extractionMethod = "docx_extraction";
      }
    } catch (extractError) {
      console.error("[upload-product-knowledge] Text extraction error:", extractError);
      // Continue with empty text - processing will handle it
      extractedText = `[Text extraction failed for ${fileName}. File uploaded but may need manual review.]`;
      extractionMethod = "extraction_failed";
    }

    // Insert into product_knowledge table
    const { data: insertData, error: insertError } = await supabase
      .from("product_knowledge")
      .insert({
        source_url: `storage://product-documents/${storagePath}`,
        title: title || fileName.replace(/\.[^.]+$/, ""),
        page_type: pageType || "document",
        raw_markdown: extractedText,
        scrape_status: extractedText ? "completed" : "pending",
        scraped_at: new Date().toISOString(),
        source_type: "uploaded",
        file_path: storagePath,
        original_filename: fileName,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[upload-product-knowledge] Insert error:", insertError);
      // Try to clean up the uploaded file
      await supabase.storage.from("product-documents").remove([storagePath]);
      return new Response(
        JSON.stringify({ success: false, error: `Database insert failed: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger processing for chunking and embeddings
    try {
      const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-product-knowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          source_ids: [insertData.id],
        }),
      });

      if (!processResponse.ok) {
        console.warn("[upload-product-knowledge] Processing trigger failed, will be picked up later");
      }
    } catch (processError) {
      console.warn("[upload-product-knowledge] Processing trigger error:", processError);
      // Non-fatal - processing can be triggered manually later
    }

    const response: UploadResponse = {
      success: true,
      id: insertData.id,
      message: `Document "${fileName}" uploaded successfully. ${extractionMethod === "extraction_failed" ? "Text extraction failed - manual review needed." : "Processing started."}`,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[upload-product-knowledge] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Extract text from PDF bytes using basic pattern matching
 * This is a simple extraction that works for most text-based PDFs
 */
async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  // Convert to string to find text streams
  const pdfString = new TextDecoder("latin1").decode(pdfBytes);
  
  const textParts: string[] = [];
  
  // Find text between BT (begin text) and ET (end text) markers
  const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  
  while ((match = btEtPattern.exec(pdfString)) !== null) {
    const textBlock = match[1];
    
    // Extract text from Tj and TJ operators
    const tjPattern = /\((.*?)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjPattern.exec(textBlock)) !== null) {
      textParts.push(tjMatch[1]);
    }
    
    // Handle TJ arrays
    const tjArrayPattern = /\[(.*?)\]\s*TJ/g;
    let tjArrayMatch;
    while ((tjArrayMatch = tjArrayPattern.exec(textBlock)) !== null) {
      const arrayContent = tjArrayMatch[1];
      const stringPattern = /\((.*?)\)/g;
      let strMatch;
      while ((strMatch = stringPattern.exec(arrayContent)) !== null) {
        textParts.push(strMatch[1]);
      }
    }
  }
  
  // Clean up the extracted text
  let text = textParts.join(" ");
  
  // Decode PDF escape sequences
  text = text
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
  
  // Remove excessive whitespace
  text = text.replace(/\s+/g, " ").trim();
  
  if (!text || text.length < 10) {
    // Fallback: try to find any readable text in the PDF
    const readablePattern = /[A-Za-z]{3,}[\w\s.,!?;:'"()-]*/g;
    const readable = pdfString.match(readablePattern);
    if (readable && readable.length > 0) {
      text = readable.filter(s => s.length > 10).join(" ");
    }
  }
  
  return text || "[PDF text extraction produced no readable content]";
}

/**
 * Extract text from DOCX bytes
 * DOCX is a ZIP file containing XML documents
 */
async function extractDocxText(docxBytes: Uint8Array): Promise<string> {
  try {
    // Use DecompressionStream to unzip the DOCX file
    // DOCX structure: word/document.xml contains the main content
    
    // Simple approach: look for the document.xml content directly
    // DOCX files have a PK header (ZIP format)
    const docxString = new TextDecoder("latin1").decode(docxBytes);
    
    // Find word/document.xml content (it's compressed, so we look for text patterns)
    // Extract text from <w:t> tags which contain the actual text
    const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const texts: string[] = [];
    let match;
    
    // First, try to find any readable XML content
    const xmlStart = docxString.indexOf("<?xml");
    if (xmlStart !== -1) {
      const xmlContent = docxString.substring(xmlStart);
      while ((match = textPattern.exec(xmlContent)) !== null) {
        if (match[1].trim()) {
          texts.push(match[1]);
        }
      }
    }
    
    // Fallback: extract any readable text sequences
    if (texts.length === 0) {
      const readablePattern = /[A-Za-z]{4,}[\w\s.,!?;:'"()-]*/g;
      const readable = docxString.match(readablePattern);
      if (readable) {
        return readable.filter(s => s.length > 10).join(" ");
      }
    }
    
    return texts.join(" ") || "[DOCX text extraction produced no readable content]";
  } catch (error) {
    console.error("[extractDocxText] Error:", error);
    return "[DOCX extraction error]";
  }
}

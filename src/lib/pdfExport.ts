/**
 * Secure PDF Export utility using jsPDF v4.0.0+ and html2canvas
 * Replaces vulnerable html2pdf.js dependency
 */

import { sanitizeHtmlForPdf } from './sanitize';

export interface PdfExportOptions {
  filename: string;
  margin?: number | [number, number, number, number]; // [top, right, bottom, left] in mm
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  scale?: number;
  imageQuality?: number;
}

const DEFAULT_OPTIONS: Required<PdfExportOptions> = {
  filename: 'document.pdf',
  margin: 10,
  format: 'a4',
  orientation: 'portrait',
  scale: 2,
  imageQuality: 0.98,
};

/**
 * Export HTML content to PDF securely
 * @param htmlContent - The HTML string to export
 * @param options - PDF export configuration
 */
export async function exportHtmlToPdf(
  htmlContent: string,
  options: PdfExportOptions
): Promise<void> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Create a temporary container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px'; // Fixed width for consistent rendering
  
  // Sanitize HTML before rendering (defense-in-depth)
  container.innerHTML = sanitizeHtmlForPdf(htmlContent);
  document.body.appendChild(container);

  try {
    // Dynamically import heavy libraries
    const { default: html2canvas } = await import('html2canvas');

    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: config.scale,
      useCORS: true,
      logging: false,
      allowTaint: false,
    });

    // Calculate dimensions
    const _imgData = canvas.toDataURL('image/jpeg', config.imageQuality);
    
    // Page dimensions in mm
    const pageWidth = config.format === 'a4' ? 210 : 215.9; // A4 or Letter
    const pageHeight = config.format === 'a4' ? 297 : 279.4;
    
    // Parse margin
    const margins = Array.isArray(config.margin)
      ? config.margin
      : [config.margin, config.margin, config.margin, config.margin];
    const [marginTop, marginRight, marginBottom, marginLeft] = margins;
    
    const contentWidth = pageWidth - marginLeft - marginRight;
    const contentHeight = pageHeight - marginTop - marginBottom;
    
    // Calculate image dimensions to fit the page
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');

    // Create PDF
    const pdf = new jsPDF({
      orientation: config.orientation,
      unit: 'mm',
      format: config.format,
    });

    // Handle multi-page content
    let _yPosition = marginTop;
    let remainingHeight = imgHeight;
    let sourceY = 0;
    let pageNum = 0;

    while (remainingHeight > 0) {
      if (pageNum > 0) {
        pdf.addPage();
      }

      const heightToRender = Math.min(remainingHeight, contentHeight);
      const sourceHeight = (heightToRender / imgHeight) * canvas.height;

      // Create a cropped canvas for this page segment
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(
          canvas,
          0, sourceY,
          canvas.width, sourceHeight,
          0, 0,
          canvas.width, sourceHeight
        );
        
        const pageImgData = pageCanvas.toDataURL('image/jpeg', config.imageQuality);
        pdf.addImage(pageImgData, 'JPEG', marginLeft, marginTop, imgWidth, heightToRender);
      }

      sourceY += sourceHeight;
      remainingHeight -= contentHeight;
      pageNum++;
    }

    // Download the PDF
    pdf.save(config.filename);
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Legacy compatibility wrapper that mimics html2pdf.js API
 * For gradual migration of existing code
 */
export function createPdfExporter() {
  let element: HTMLElement | null = null;
  let config: PdfExportOptions = { filename: 'document.pdf' };

  const exporter = {
    from(el: HTMLElement) {
      element = el;
      return exporter;
    },
    set(options: {
      margin?: number | number[];
      filename?: string;
      html2canvas?: { scale?: number; useCORS?: boolean };
      jsPDF?: { unit?: string; format?: string | number[]; orientation?: 'portrait' | 'landscape' };
      image?: { type?: string; quality?: number };
    }) {
      if (options.margin !== undefined) {
        config.margin = Array.isArray(options.margin) 
          ? options.margin as [number, number, number, number]
          : options.margin;
      }
      if (options.filename) config.filename = options.filename;
      if (options.html2canvas?.scale) config.scale = options.html2canvas.scale;
      if (options.image?.quality) config.imageQuality = options.image.quality;
      if (options.jsPDF?.orientation) config.orientation = options.jsPDF.orientation;
      if (options.jsPDF?.format) {
        if (typeof options.jsPDF.format === 'string') {
          config.format = options.jsPDF.format as 'a4' | 'letter';
        }
      }
      return exporter;
    },
    async save() {
      if (!element) {
        throw new Error('No element provided. Call .from(element) first.');
      }
      await exportHtmlToPdf(element.innerHTML, config);
    },
  };

  return exporter;
}

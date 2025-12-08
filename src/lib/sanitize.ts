/**
 * HTML Sanitization utility for defense-in-depth against XSS
 * Uses DOMPurify to sanitize HTML content before rendering
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content for safe rendering
 * Removes potentially dangerous scripts, event handlers, etc.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'strong', 'em', 'b', 'i', 'u',
      'blockquote', 'code', 'pre',
      'a', 'img',
    ],
    ALLOWED_ATTR: [
      'style', 'class', 'id',
      'href', 'src', 'alt', 'title',
      'colspan', 'rowspan', 'scope',
    ],
    // Allow safe inline styles for PDF generation
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize HTML specifically for PDF export
 * More permissive with styles but still removes scripts
 */
export function sanitizeHtmlForPdf(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'strong', 'em', 'b', 'i', 'u',
      'blockquote', 'code', 'pre',
      'a', 'img',
    ],
    ALLOWED_ATTR: [
      'style', 'class', 'id',
      'href', 'src', 'alt', 'title',
      'colspan', 'rowspan', 'scope',
      'width', 'height',
    ],
    // PDF generation relies on inline styles
    ALLOW_DATA_ATTR: false,
    // Remove any javascript: URLs
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover'],
  });
}

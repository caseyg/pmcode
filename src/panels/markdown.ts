import { Marked } from 'marked';

const renderer = new Marked({ async: false });

/**
 * Render markdown to HTML for use in webview panels.
 *
 * Uses `marked` for full CommonMark support (headings, lists, bold, italic,
 * code blocks, links, tables, etc.). Raw HTML tags in the markdown source
 * are escaped to prevent XSS — the CSP also blocks inline scripts as a
 * second layer of defense.
 */
export function renderMarkdown(md: string): string {
  if (!md) { return ''; }
  // Escape HTML entities in the source before parsing so raw <tags> don't
  // pass through. Marked will still generate its own HTML from markdown syntax.
  const escaped = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return renderer.parse(escaped) as string;
}

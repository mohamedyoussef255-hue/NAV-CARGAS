/**
 * Escapes HTML special characters so verbatim text (including quotes, <, >, &)
 * renders identically in DOM text and HTML attribute values without truncation.
 */
export function escapeHtml(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

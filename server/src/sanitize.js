import sanitizeHtml from 'sanitize-html';

// Mirrors what the editor can actually produce. Anything else (scripts, inline
// styles, event handlers, links) is dropped, but the text inside is kept.
const OPTIONS = {
  allowedTags: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3',
    'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
  ],
  allowedAttributes: {},
  transformTags: {
    h4: 'h3',
    h5: 'h3',
    h6: 'h3',
  },
};

export function cleanHtml(html) {
  return sanitizeHtml(html, OPTIONS);
}

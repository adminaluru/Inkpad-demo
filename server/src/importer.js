import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { HttpError } from './errors.js';
import { MAX_TITLE_LENGTH } from './validate.js';

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function extensionOf(filename) {
  return path.extname(filename || '').toLowerCase();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function plainTextToHtml(text) {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

// multer hands us the filename as latin1, which mangles non-ASCII names.
function decodeFilename(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

export function titleFromFilename(originalName) {
  const name = decodeFilename(originalName);
  const base = path.basename(name, path.extname(name)).trim();
  return (base || 'Imported document').slice(0, MAX_TITLE_LENGTH);
}

// Returns raw HTML. The caller is responsible for sanitising it.
export async function fileToHtml(file) {
  const ext = extensionOf(file.originalname);

  if (ext === '.docx') {
    try {
      // mammoth drops underline unless it is mapped explicitly.
      const result = await mammoth.convertToHtml(
        { buffer: file.buffer },
        { styleMap: ['u => u'] },
      );
      return result.value;
    } catch (err) {
      throw new HttpError(422, "We couldn't read that .docx file. It may be corrupted.");
    }
  }

  const text = file.buffer.toString('utf8').replace(/^﻿/, '');
  if (ext === '.md') {
    return marked.parse(text, { async: false });
  }
  if (ext === '.txt') {
    return plainTextToHtml(text);
  }

  throw new HttpError(415, `Unsupported file type. Upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}.`);
}

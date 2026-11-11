import { HttpError } from './errors.js';

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 1_000_000;
export const ROLES = ['viewer', 'editor'];

export function parseTitle(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Title must be text.');
  }
  const title = value.trim();
  if (!title) {
    throw new HttpError(400, 'Title cannot be empty.');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new HttpError(400, `Title cannot be longer than ${MAX_TITLE_LENGTH} characters.`);
  }
  return title;
}

export function parseContent(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Content must be text.');
  }
  if (value.length > MAX_CONTENT_LENGTH) {
    throw new HttpError(413, 'That document is too large to save.');
  }
  return value;
}

export function parseRole(value) {
  if (!ROLES.includes(value)) {
    throw new HttpError(400, `Role must be one of: ${ROLES.join(', ')}.`);
  }
  return value;
}

export function parseEmail(value) {
  if (typeof value !== 'string' || !/^\S+@\S+\.\S+$/.test(value.trim())) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  return value.trim().toLowerCase();
}

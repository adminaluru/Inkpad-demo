const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status);
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  listUsers: () => request('/users'),

  listDocuments: () => request('/documents'),
  createDocument: () => request('/documents', { method: 'POST', body: {} }),
  getDocument: (id) => request(`/documents/${id}`),
  updateDocument: (id, changes) => request(`/documents/${id}`, { method: 'PATCH', body: changes }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  importDocument: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/documents/import', { method: 'POST', body: form });
  },

  share: (id, email, role) => request(`/documents/${id}/shares`, { method: 'PUT', body: { email, role } }),
  unshare: (id, userId) => request(`/documents/${id}/shares/${userId}`, { method: 'DELETE' }),
};

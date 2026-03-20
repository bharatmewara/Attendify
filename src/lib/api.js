const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const parseResponse = async (res) => {
  const text = await res.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      data?.message ||
      (typeof data === 'string' && data) ||
      text ||
      `${res.status} ${res.statusText}`.trim() ||
      'Request failed';
    throw new Error(message);
  }
  return data ?? {};
};

const getToken = (tokenOverride) => tokenOverride || localStorage.getItem('attendify_token');

export const apiRequest = async (path, { method = 'GET', body, token, headers: customHeaders } = {}) => {
  const authToken = getToken(token);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...customHeaders,
  };

  if (body !== undefined && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData || typeof body === 'string' ? body : JSON.stringify(body),
  });

  return parseResponse(response);
};

export { API_BASE_URL };

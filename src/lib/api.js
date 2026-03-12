const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://attendify-ue4a.onrender.com/api';

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

export const apiRequest = async (path, { method = 'GET', body, token } = {}) => {
  const authToken = getToken(token);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
};

export { API_BASE_URL };

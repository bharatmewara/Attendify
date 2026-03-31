const normalizeApiBaseUrl = (url) => {
  const value = (url || '').toString().trim();
  if (!value) {
    return 'http://localhost:4000/api';
  }

  let normalized = value;

  if (normalized.startsWith('//')) {
    if (typeof window !== 'undefined' && window.location?.protocol) {
      normalized = `${window.location.protocol}${normalized}`;
    } else {
      normalized = `http:${normalized}`;
    }
  } else if (!/^https?:\/\//i.test(normalized)) {
    if (typeof window !== 'undefined' && window.location?.protocol) {
      normalized = `${window.location.protocol}//${normalized}`;
    } else {
      normalized = `http://${normalized}`;
    }
  }

  const forceHttp = (import.meta.env.VITE_FORCE_HTTP || '').toString().trim().toLowerCase() === 'true';
  if (forceHttp && normalized.toLowerCase().startsWith('https://')) {
    normalized = `http://${normalized.slice(8)}`;
  }

  return normalized;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const TOKEN_KEY = 'attendify_token';

if (typeof window !== 'undefined') {
  const pageIsHttps = window.location?.protocol === 'https:';
  const apiIsHttp = API_BASE_URL.toLowerCase().startsWith('http://');
  if (pageIsHttps && apiIsHttp) {
    console.warn(
      '[Attendify] API is HTTP but the app is loaded over HTTPS. This will be blocked in browsers. ' +
        'Use an HTTPS API endpoint (recommended) or serve the app over HTTP during local testing.'
    );
  }
}

const getStoredToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
};

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

const getToken = (tokenOverride) => tokenOverride || getStoredToken();

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

export { API_BASE_URL, TOKEN_KEY, getStoredToken };

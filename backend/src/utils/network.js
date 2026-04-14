export const getClientIp = (req) => {
  // Highest priority: real public IP sent by the frontend (detected via ipify.org)
  // This solves the localhost proxy problem where backend always sees 127.0.0.1
  const clientRealIp = req.headers['x-client-real-ip'];
  if (clientRealIp) return normalizeIp(clientRealIp.trim());

  // Production reverse proxy headers
  const realIp = req.headers['x-real-ip'];
  if (realIp) return normalizeIp(realIp.split(',')[0].trim());

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return normalizeIp(forwarded.split(',')[0].trim());

  // Cloudflare
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return normalizeIp(cf.trim());

  // Direct socket connection
  const rawIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return normalizeIp(rawIp);
};

const normalizeIp = (ip) => {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
};

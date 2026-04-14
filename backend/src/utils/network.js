export const getClientIp = (req) => {
  // Production reverse proxy headers (trusted server-side only)
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

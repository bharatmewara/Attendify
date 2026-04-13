export const getClientIp = (req) => {
  // Check common proxy headers in priority order
  const proxyHeaders = [
    'x-real-ip',
    'x-forwarded-for',
    'cf-connecting-ip',   // Cloudflare
    'x-client-ip',
  ];

  for (const header of proxyHeaders) {
    const val = req.headers[header];
    if (val) {
      const ip = val.split(',')[0].trim();
      if (ip) return normalizeIp(ip);
    }
  }

  const rawIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return normalizeIp(rawIp);
};

const normalizeIp = (ip) => {
  if (!ip) return '';
  // Strip IPv6-mapped IPv4 prefix
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  // Loopback normalization
  if (ip === '::1') return '127.0.0.1';
  return ip;
};

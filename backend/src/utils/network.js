export const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const [first] = forwarded.split(',');
    return first.trim();
  }

  const rawIp = req.ip || req.connection?.remoteAddress || '';
  if (rawIp.startsWith('::ffff:')) {
    return rawIp.replace('::ffff:', '');
  }
  return rawIp;
};

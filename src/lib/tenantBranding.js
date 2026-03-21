export const getTenantBrandName = () => {
  if (typeof window === 'undefined') {
    return 'Attendify';
  }

  const params = new URLSearchParams(window.location.search);
  const queryBrand = params.get('company');
  if (queryBrand) {
    return queryBrand.replace(/[-_]+/g, ' ').trim();
  }

  const host = window.location.hostname;
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return 'Attendify';
  }

  const firstLabel = host.split('.')[0];
  if (!firstLabel || firstLabel === 'www') {
    return 'Attendify';
  }

  return firstLabel.replace(/[-_]+/g, ' ').trim();
};

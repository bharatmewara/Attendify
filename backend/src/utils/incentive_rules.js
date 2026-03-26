export const defaultIncentiveRulesConfigV1 = () => ({
  version: 1,
  renewal_multiplier: 0.5,
  products: [
    {
      name: 'Bulk SMS',
      active: true,
      rules: [
        { mode: 'set', min_qty: 100000, max_qty: 199999, min_rate: 0.08, max_rate: 0.14, flat: 200 },
        { mode: 'set', min_qty: 200000, max_qty: 299999, min_rate: 0.08, max_rate: 0.14, flat: 250 },
        { mode: 'set', min_qty: 300000, max_qty: 399999, min_rate: 0.08, max_rate: 0.14, flat: 300 },
        { mode: 'set', min_qty: 400000, max_qty: 499999, min_rate: 0.08, max_rate: 0.14, flat: 400 },
        { mode: 'set', min_qty: 500000, max_qty: 900000, min_rate: 0.08, max_rate: 0.14, flat: 500 },
        { mode: 'add', min_qty: 1000000, max_qty: 1500000, percent_of_price: 0.02 },
      ],
    },
    {
      name: 'WhatsApp SMS',
      active: true,
      rules: [
        { mode: 'set', min_qty: 50000, max_qty: 99999, min_rate: 0.03, max_rate: 0.04, flat: 100 },

        { mode: 'set', min_qty: 100000, max_qty: 199999, min_rate: 0.05, max_rate: 0.06, flat: 200 },
        { mode: 'set', min_qty: 100000, max_qty: 199999, min_rate: 0.06, max_rate: 0.12, flat: 300 },

        { mode: 'set', min_qty: 200000, max_qty: 299999, min_rate: 0.03, max_rate: 0.04, flat: 200 },
        { mode: 'set', min_qty: 200000, max_qty: 299999, min_rate: 0.05, max_rate: 0.06, flat: 300 },
        { mode: 'set', min_qty: 200000, max_qty: 299999, min_rate: 0.07, max_rate: 0.12, flat: 400 },

        { mode: 'set', min_qty: 300000, max_qty: 399999, min_rate: 0.03, max_rate: 0.04, flat: 250 },
        { mode: 'set', min_qty: 300000, max_qty: 399999, min_rate: 0.05, max_rate: 0.06, flat: 350 },
        { mode: 'set', min_qty: 300000, max_qty: 399999, min_rate: 0.07, max_rate: 0.12, flat: 500 },

        { mode: 'set', min_qty: 400000, max_qty: 499999, min_rate: 0.03, max_rate: 0.04, flat: 300 },
        { mode: 'set', min_qty: 400000, max_qty: 499999, min_rate: 0.05, max_rate: 0.06, flat: 400 },
        { mode: 'set', min_qty: 400000, max_qty: 499999, min_rate: 0.07, max_rate: 0.12, flat: 600 },

        { mode: 'set', min_qty: 500000, min_rate: 0.03, max_rate: 0.06, flat: 400 },
        { mode: 'set', min_qty: 500000, min_rate: 0.07, max_rate: 0.09, flat: 900 },
        { mode: 'set', min_qty: 500000, min_rate: 0.1, max_rate: 0.12, flat: 1200 },
      ],
    },
    { name: 'WhatsApp Meta Setup', active: true, rules: [{ mode: 'set', flat: 100 }] },
    { name: 'WhatsApp Meta Recharge', active: true, rules: [{ mode: 'set', max_price: 5000, flat: 100 }] },
    { name: 'WhatsApp Meta Subscription', active: true, rules: [{ mode: 'set', flat: 200 }] },
    { name: 'RCS Setup', active: true, rules: [{ mode: 'set', flat: 100 }] },
    { name: 'RCS Recharge', active: true, rules: [{ mode: 'set', max_price: 15000, flat: 100 }] },
  ],
});

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

export const validateIncentiveRulesConfigV1 = (config) => {
  if (!config || typeof config !== 'object') return { ok: false, message: 'Config must be an object.' };
  if (config.version !== 1) return { ok: false, message: 'Only version=1 is supported.' };
  if (!Array.isArray(config.products)) return { ok: false, message: 'products[] is required.' };

  for (const product of config.products) {
    if (!product || typeof product !== 'object') return { ok: false, message: 'Each product must be an object.' };
    if (!product.name || typeof product.name !== 'string') return { ok: false, message: 'Each product needs a name.' };
    if (!Array.isArray(product.rules)) return { ok: false, message: `Product ${product.name} needs rules[].` };

    for (const rule of product.rules) {
      if (!rule || typeof rule !== 'object') return { ok: false, message: `Invalid rule in ${product.name}.` };
      const mode = rule.mode || 'set';
      if (!['set', 'add'].includes(mode)) return { ok: false, message: `Rule mode must be set/add in ${product.name}.` };

      const numericFields = ['min_qty', 'max_qty', 'min_rate', 'max_rate', 'min_price', 'max_price', 'flat', 'percent_of_price', 'priority'];
      for (const f of numericFields) {
        if (Object.prototype.hasOwnProperty.call(rule, f) && rule[f] !== null && rule[f] !== undefined) {
          const num = Number(rule[f]);
          if (!Number.isFinite(num)) return { ok: false, message: `Rule field ${f} must be numeric in ${product.name}.` };
        }
      }

      if (!Object.prototype.hasOwnProperty.call(rule, 'flat') && !Object.prototype.hasOwnProperty.call(rule, 'percent_of_price')) {
        return { ok: false, message: `Rule must include flat or percent_of_price in ${product.name}.` };
      }

      if (Object.prototype.hasOwnProperty.call(rule, 'percent_of_price')) {
        const pct = Number(rule.percent_of_price);
        if (!isNumber(pct) || pct < 0 || pct > 1) return { ok: false, message: `percent_of_price must be between 0 and 1 in ${product.name}.` };
      }
    }
  }

  return { ok: true };
};

const matchesRange = (value, min, max) => {
  if (min !== null && min !== undefined && isNumber(Number(min)) && value < Number(min)) return false;
  if (max !== null && max !== undefined && isNumber(Number(max)) && value > Number(max)) return false;
  return true;
};

export const getActiveProductNamesFromRules = (config) => {
  if (!config || config.version !== 1 || !Array.isArray(config.products)) return [];
  return config.products
    .filter((p) => p && p.active !== false)
    .map((p) => String(p.name))
    .filter(Boolean);
};

export const isProductActiveInRules = (config, productName) => {
  if (!config || config.version !== 1 || !Array.isArray(config.products)) return null;
  const product = config.products.find((p) => String(p.name) === String(productName));
  if (!product) return null;
  return product.active !== false;
};

export const calculateIncentiveFromRules = ({
  config,
  productName,
  smsQuantity,
  rate,
  price,
  packageType,
}) => {
  if (!config || config.version !== 1 || !Array.isArray(config.products)) return null;

  const product = config.products.find((p) => String(p.name) === String(productName));
  if (!product || product.active === false) return null;

  const qty = Number(smsQuantity || 0);
  const rateNum = rate === undefined || rate === null || rate === '' ? null : Number(rate);
  const priceNum = Number(price || 0);

  const rules = (product.rules || [])
    .slice()
    .sort((a, b) => Number(a?.priority || 0) - Number(b?.priority || 0));

  let incentive = 0;

  for (const rule of rules) {
    const matchQty = matchesRange(qty, rule.min_qty, rule.max_qty);
    const matchRate = rateNum === null ? matchesRange(0, rule.min_rate, rule.max_rate) : matchesRange(rateNum, rule.min_rate, rule.max_rate);
    const matchPrice = matchesRange(priceNum, rule.min_price, rule.max_price);

    if (!matchQty || !matchRate || !matchPrice) continue;

    const flat = rule.flat !== undefined && rule.flat !== null ? Number(rule.flat) : 0;
    const pct = rule.percent_of_price !== undefined && rule.percent_of_price !== null ? Number(rule.percent_of_price) : 0;
    const amount = (Number.isFinite(flat) ? flat : 0) + (Number.isFinite(pct) ? priceNum * pct : 0);

    if (String(rule.mode || 'set') === 'add') {
      incentive += amount;
    } else {
      incentive = amount;
    }
  }

  if (String(packageType).toLowerCase() === 'renew') {
    const mult = config.renewal_multiplier !== undefined ? Number(config.renewal_multiplier) : 0.5;
    incentive *= Number.isFinite(mult) ? mult : 0.5;
  }

  return incentive;
};

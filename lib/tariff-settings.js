const DEFAULT_TARIFF_RATE = 7.0;
const TARIFF_HISTORY_KEY = 'tariff_rate_history';

function formatUkDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function normalizeEffectiveDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatUkDate(parsed);
}

function normalizeTariffEntry(input) {
  const rate = Number(input?.rate ?? input?.tariffRate);
  const effectiveDate = normalizeEffectiveDate(
    input?.effectiveDate ?? input?.effectiveFrom ?? input?.date
  );

  if (!Number.isFinite(rate) || rate < 0 || !effectiveDate) {
    return null;
  }

  return {
    id: String(input?.id || `tariff-${effectiveDate}-${rate}`),
    rate,
    effectiveDate,
    source: input?.source || 'manual'
  };
}

function compareTariffEntries(a, b) {
  return a.effectiveDate.localeCompare(b.effectiveDate) || String(a.id).localeCompare(String(b.id));
}

function getDefaultTariffHistory() {
  return [
    {
      id: 'tariff-2026-01-01-7p',
      rate: 7.0,
      effectiveDate: '2026-01-01',
      source: 'seed'
    }
  ];
}

async function getSettingValue(pool, key) {
  const result = await pool.query(
    'SELECT value FROM app_settings WHERE key = $1',
    [key]
  );

  if (!result.rows.length) return null;

  try {
    return JSON.parse(result.rows[0].value);
  } catch (error) {
    console.error(`Error parsing setting "${key}":`, error);
    return null;
  }
}

async function setSettingValue(pool, key, value) {
  await pool.query(
    `INSERT INTO app_settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

async function getTariffHistory(pool) {
  const stored = await getSettingValue(pool, TARIFF_HISTORY_KEY);
  const defaults = getDefaultTariffHistory().map(normalizeTariffEntry).filter(Boolean);
  const saved = Array.isArray(stored)
    ? stored.map(normalizeTariffEntry).filter(Boolean)
    : [];

  const merged = new Map();
  [...defaults, ...saved].forEach((entry) => {
    merged.set(`${entry.effectiveDate}|${entry.rate}`, entry);
  });

  return [...merged.values()].sort(compareTariffEntries);
}

function resolveTariffEntryForDate(history, value, fallbackRate = DEFAULT_TARIFF_RATE) {
  const entries = Array.isArray(history)
    ? history.map(normalizeTariffEntry).filter(Boolean).sort(compareTariffEntries)
    : [];
  const targetDate = normalizeEffectiveDate(value) || formatUkDate(new Date());

  if (!entries.length) {
    return {
      id: `fallback-${targetDate}-${fallbackRate}`,
      rate: fallbackRate,
      effectiveDate: targetDate,
      source: 'fallback'
    };
  }

  const applicable = entries.filter((entry) => entry.effectiveDate <= targetDate);
  return applicable[applicable.length - 1] || entries[0];
}

function resolveTariffRateForDate(history, value, fallbackRate = DEFAULT_TARIFF_RATE) {
  return resolveTariffEntryForDate(history, value, fallbackRate).rate;
}

function getActiveTariffEntry(history, value = new Date(), fallbackRate = DEFAULT_TARIFF_RATE) {
  return resolveTariffEntryForDate(history, value, fallbackRate);
}

function getActiveTariffRate(history, value = new Date(), fallbackRate = DEFAULT_TARIFF_RATE) {
  return resolveTariffRateForDate(history, value, fallbackRate);
}

async function appendTariffHistoryEntry(pool, entryLike) {
  const entry = normalizeTariffEntry(entryLike);
  if (!entry) return null;

  const history = await getTariffHistory(pool);
  history.push(entry);

  const deduped = new Map();
  history.forEach((item) => {
    deduped.set(`${item.effectiveDate}|${item.rate}`, item);
  });

  const nextHistory = [...deduped.values()].sort(compareTariffEntries);
  await setSettingValue(pool, TARIFF_HISTORY_KEY, nextHistory);
  return { entry, history: nextHistory };
}

module.exports = {
  DEFAULT_TARIFF_RATE,
  getDefaultTariffHistory,
  normalizeTariffEntry,
  getTariffHistory,
  getActiveTariffEntry,
  getActiveTariffRate,
  resolveTariffEntryForDate,
  resolveTariffRateForDate,
  appendTariffHistoryEntry
};

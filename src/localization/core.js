import messages from "./messages.json";
const folded = new Map(
  Object.keys(messages).map((key) => [key.toLowerCase(), key]),
);
export const languages = {
  en: { label: "English", locale: "en-IN" },
  hi: { label: "हिन्दी", locale: "hi-IN" },
  gu: { label: "ગુજરાતી", locale: "gu-IN" },
};
export const normalizeLanguage = (value) =>
  Object.hasOwn(languages, value) ? value : "en";
export function translate(language, key, values = {}) {
  if (typeof key !== "string") return key;
  const match = Object.hasOwn(messages, key)
    ? key
    : folded.get(key.toLowerCase());
  const pair = match ? messages[match] : null;
  const text =
    language === "hi"
      ? pair?.[0] || key
      : language === "gu"
        ? pair?.[1] || key
        : key;
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
export const preferenceKey = (scope = "admin") =>
  `commerce_locale_${String(scope)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 90)}`;
export function parsePreference(raw, defaultLanguage = "en") {
  let decoded = "";
  try {
    decoded = decodeURIComponent(raw || "");
  } catch {
    /* Ignore malformed untrusted preferences. */
  }
  const [language, currency] = decoded.split(":");
  return {
    language: Object.hasOwn(languages, language)
      ? language
      : normalizeLanguage(defaultLanguage),
    currency: ["INR", "USD", "EUR"].includes(currency) ? currency : "INR",
  };
}
export function activeCurrencies(settings, now = Date.now()) {
  const result = ["INR"];
  if (settings?.baseCurrency !== "INR" || settings?.checkoutCurrency !== "INR")
    return result;
  for (const code of ["USD", "EUR"]) {
    const rate = Number(settings.inrPerUnit?.[code]),
      detail = settings.rateDetails?.[code];
    if (
      settings.currencies?.includes(code) &&
      Number.isFinite(rate) &&
      rate > 0 &&
      detail &&
      new Date(detail.asOf).getTime() <= now &&
      new Date(detail.validUntil).getTime() > now
    )
      result.push(code);
  }
  return result;
}
export function price(
  value,
  language = "en",
  currency = "INR",
  settings = null,
  now = Date.now(),
) {
  const chosen = activeCurrencies(settings, now).includes(currency)
    ? currency
    : "INR";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${chosen === "INR" ? "" : "≈ "}${new Intl.NumberFormat(languages[normalizeLanguage(language)].locale, { style: "currency", currency: chosen, maximumFractionDigits: 2 }).format(chosen === "INR" ? amount : amount / Number(settings.inrPerUnit[chosen]))}`;
}

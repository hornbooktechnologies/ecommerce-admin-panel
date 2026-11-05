"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  languages,
  normalizeLanguage,
  translate,
  preferenceKey,
  activeCurrencies,
  price,
} from "./core";
import styles from "./localization.module.css";
const Context = createContext(null);
const allLanguages = ["en", "hi", "gu"];
export function LocalizationProvider({
  children,
  initialLanguage = "en",
  initialCurrency = "INR",
  settings = null,
  scope = "admin",
  initialTime = 0,
}) {
  const enabled = settings?.languages || allLanguages;
  const [requestedLanguage, setLanguageState] = useState(initialLanguage);
  const language = enabled.includes(requestedLanguage)
    ? normalizeLanguage(requestedLanguage)
    : normalizeLanguage(settings?.defaultLanguage);
  const [currency, setCurrencyState] = useState(initialCurrency);
  const [now, setNow] = useState(initialTime);
  const available = useMemo(
      () => activeCurrencies(settings, now),
      [settings, now],
    ),
    effectiveCurrency = available.includes(currency) ? currency : "INR";
  const cookieKey = preferenceKey(scope);
  const remember = useCallback(
    (nextLanguage, nextCurrency) => {
      try {
        document.cookie = `${cookieKey}=${encodeURIComponent(`${nextLanguage}:${nextCurrency}`)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      } catch {
        /* Preferences still work for this visit. */
      }
    },
    [cookieKey],
  );
  const setLanguage = useCallback(
    (value) => {
      if (!enabled.includes(value)) return;
      setLanguageState(value);
      remember(value, effectiveCurrency);
    },
    [enabled, remember, effectiveCurrency],
  );
  const setCurrency = useCallback(
    (value) => {
      if (!available.includes(value)) return;
      setCurrencyState(value);
      remember(language, value);
    },
    [available, remember, language],
  );
  useEffect(() => {
    document.documentElement.lang = languages[language].locale;
    document.documentElement.dataset.uiLanguage = language;
  }, [language]);
  useEffect(() => {
    if (!settings) return;
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      const at = Date.now();
      setNow(at);
      const expiry = Object.values(settings.rateDetails || {})
        .map((row) => new Date(row.validUntil).getTime())
        .filter((value) => value > at)
        .sort((a, b) => a - b)[0];
      if (expiry)
        timer = window.setTimeout(
          refresh,
          Math.min(expiry - at + 1, 2147483647),
        );
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [settings]);
  const t = useCallback(
    (key, values) => translate(language, key, values),
    [language],
  );
  const money = useCallback(
    (amount, sourceCurrency = "INR") =>
      sourceCurrency === "INR"
        ? price(amount, language, effectiveCurrency, settings, now)
        : new Intl.NumberFormat(languages[language].locale, {
            style: "currency",
            currency: sourceCurrency,
          }).format(amount),
    [language, effectiveCurrency, settings, now],
  );
  const transactionMoney = useCallback(
    (amount) => price(amount, language, "INR"),
    [language],
  );
  const value = useMemo(
    () => ({
      interactive:true,
      language,
      currency: effectiveCurrency,
      setLanguage,
      setCurrency,
      enabled,
      available,
      settings,
      t,
      money,
      transactionMoney,
    }),
    [
      language,
      effectiveCurrency,
      setLanguage,
      setCurrency,
      enabled,
      available,
      settings,
      t,
      money,
      transactionMoney,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
const fallback = {
  interactive:false,
  enabled:allLanguages,
  available:['INR'],
  setLanguage:()=>{},
  setCurrency:()=>{},
  language: "en",
  currency: "INR",
  t: (key, values) => translate("en", key, values),
  money: (value) => price(value),
  transactionMoney: (value) => price(value),
};
export function useLocalization() {
  return useContext(Context) || fallback;
}
export function LocalizedText({ text }) {
  const { t } = useLocalization();
  return t(text);
}
export function LocalizationControls({ displayCurrency = false }) {
  const {interactive}=useLocalization();
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  const {
    language,
    currency,
    setLanguage,
    setCurrency,
    enabled,
    available,
    t,
  } = useLocalization();
  return (
    <div
      className={styles.controls}
      data-localization-controls
      aria-label={t("Language")}
    >
      <label className={styles.control}>
        <span>{t("Language")}</span>
        <select
          aria-label={t("Language")}
          disabled={!ready||!interactive}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {enabled.map((code) => (
            <option key={code} value={code} lang={languages[code].locale}>
              {languages[code].label}
            </option>
          ))}
        </select>
      </label>
      {displayCurrency && (
        <label className={styles.control}>
          <span>{t("Display currency")}</span>
          <select
            aria-label={t("Display currency")}
            disabled={!ready||!interactive}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["INR", "USD", "EUR"].map((code) => (
              <option
                key={code}
                value={code}
                disabled={!available.includes(code)}
              >
                {code}
                {!available.includes(code)
                  ? ` — ${t("No active reference rate")}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
export function CurrencyNotice() {
  const { currency, t } = useLocalization();
  return currency !== "INR" ? (
    <p className={styles.notice} role="status">
      {t("Prices are approximate. Checkout and payments use INR.")}
    </p>
  ) : null;
}

"use client";
import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import {
  getStoreLocalizationRequest,
  saveStoreLocalizationRequest,
} from "@/lib/api-client";
import { useLocalization } from "@/localization/provider";
import { languages } from "@/localization/core";
import styles from "./store-localization.module.css";
const local = (value) =>
  value
    ? new Date(new Date(value).getTime() + 330 * 60000)
        .toISOString()
        .slice(0, 19)
    : "";
const seed = (data) => ({
  ...data,
  rates: Object.fromEntries(
    ["USD", "EUR"].map((code) => [
      code,
      {
        inrPerUnit: data.rates[code]?.inrPerUnit || "",
        asOf: local(data.rates[code]?.asOf),
        validUntil: local(data.rates[code]?.validUntil),
      },
    ]),
  ),
});
export function StoreLocalization({
  storeId,
  accessToken,
  tenantId,
  canManage,
}) {
  const { t } = useLocalization();
  const [form, setForm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [reload, setReload] = useState(0),
    [stale, setStale] = useState(false);
  useEffect(() => {
    let active = true;
    setForm(null);
    setError("");
    setStale(false);
    getStoreLocalizationRequest(storeId, accessToken, tenantId)
      .then((data) => {
        if (active) setForm(seed(data));
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [storeId, accessToken, tenantId, reload]);
  const toggle = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((row) => row !== value)
        : [...current[key], value],
    }));
  const setRate = (code, key, value) =>
    setForm((current) => ({
      ...current,
      rates: {
        ...current.rates,
        [code]: { ...current.rates[code], [key]: value },
      },
    }));
  async function submit(event) {
    event.preventDefault();
    if (busy || stale) return;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const body = {
        revision: form.revision,
        defaultLanguage: form.defaultLanguage,
        languages: form.languages,
        currencies: form.currencies,
        rates: Object.fromEntries(
          ["USD", "EUR"].map((code) => [
            code,
            form.rates[code].inrPerUnit
              ? {
                  inrPerUnit: form.rates[code].inrPerUnit,
                  asOf: `${form.rates[code].asOf}+05:30`,
                  validUntil: `${form.rates[code].validUntil}+05:30`,
                }
              : null,
          ]),
        ),
      };
      setForm(
        seed(
          await saveStoreLocalizationRequest(
            storeId,
            body,
            accessToken,
            tenantId,
          ),
        ),
      );
      setSuccess(true);
    } catch (cause) {
      setError(cause.message);
      if (cause.status === 409) setStale(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel}>
      <header>
        <Languages aria-hidden="true" size={24} />
        <div>
          <h2>{t("Languages & display currencies")}</h2>
          <p>
            {t(
              "Display conversion only. Checkout, payments, invoices and refunds remain in INR.",
            )}
          </p>
        </div>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {success && <p role="status">{t("Localization saved")}</p>}
      {!form ? (
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={() => setReload((value) => value + 1)}
        >
          {t("Reload settings")}
        </button>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={!canManage || busy || stale}>
            <div className={styles.grid}>
              <div>
                <h3>{t("Enabled languages")}</h3>
                {Object.entries(languages).map(([code, language]) => (
                  <label className={styles.check} key={code}>
                    <input
                      type="checkbox"
                      checked={form.languages.includes(code)}
                      disabled={code === "en" || code === form.defaultLanguage}
                      onChange={() => toggle("languages", code)}
                    />
                    {language.label}
                  </label>
                ))}
              </div>
              <label className="form-field">
                <span>{t("Default storefront language")}</span>
                <select
                  value={form.defaultLanguage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultLanguage: event.target.value,
                    }))
                  }
                >
                  {form.languages.map((code) => (
                    <option key={code} value={code}>
                      {languages[code].label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <h3>{t("Enabled display currencies")}</h3>
                {["INR", "USD", "EUR"].map((code) => (
                  <label className={styles.check} key={code}>
                    <input
                      type="checkbox"
                      checked={form.currencies.includes(code)}
                      disabled={code === "INR"}
                      onChange={() => toggle("currencies", code)}
                    />
                    {code}
                  </label>
                ))}
              </div>
            </div>
            <h3>{t("Reference rates")}</h3>
            <p className={styles.help}>
              {t(
                "Rates are entered manually; no live exchange-rate service is connected.",
              )}{" "}
              {t(
                "Rates expire automatically, at most 31 days after the reference time. Leave a rate blank to disable its conversion.",
              )}
            </p>
            {["USD", "EUR"].map((code) => (
              <div className={styles.grid} key={code}>
                <label className="form-field">
                  <span>{t(`INR per 1 ${code}`)}</span>
                  <input
                    inputMode="decimal"
                    pattern="(?:[1-9][0-9]{0,6}|0)(?:\.[0-9]{1,8})?"
                    placeholder="—"
                    value={form.rates[code].inrPerUnit}
                    onChange={(e) =>
                      setRate(code, "inrPerUnit", e.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>{t("Reference date (IST)")}</span>
                  <input
                    type="datetime-local"
                    step="1"
                    required={Boolean(form.rates[code].inrPerUnit)}
                    value={form.rates[code].asOf}
                    onChange={(e) => setRate(code, "asOf", e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>{t("Valid until (IST)")}</span>
                  <input
                    type="datetime-local"
                    step="1"
                    required={Boolean(form.rates[code].inrPerUnit)}
                    value={form.rates[code].validUntil}
                    onChange={(e) =>
                      setRate(code, "validUntil", e.target.value)
                    }
                  />
                </label>
              </div>
            ))}
          </fieldset>
          <footer>
            <span>{t("Transactions remain in INR")}</span>
            <div>
              {stale && (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => setReload((value) => value + 1)}
                >
                  {t("Reload settings")}
                </button>
              )}
              {canManage && (
                <button
                  className="button button-success"
                  type="submit"
                  disabled={busy || stale}
                >
                  {t(busy ? "Saving…" : "Save localization")}
                </button>
              )}
            </div>
          </footer>
        </form>
      )}
    </section>
  );
}

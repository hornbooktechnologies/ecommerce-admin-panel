const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toValidDate(value, { dateOnly = false } = {}) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = typeof value === "string" ? value.trim() : value;
  const normalized = dateOnly && typeof text === "string" && DATE_ONLY_PATTERN.test(text)
    ? `${text}T12:00:00`
    : text;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateValue(value, formatter, { dateOnly = false, fallback = "Not available" } = {}) {
  const parsed = toValidDate(value, { dateOnly });
  if (!parsed) return fallback;

  try {
    return formatter.format(parsed);
  } catch {
    return fallback;
  }
}

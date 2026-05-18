export const CUSTOMER_SOURCE_OPTIONS = [
  "WhatsApp",
  "Instagram",
  "Delivery",
  "Evento",
  "Sistema de Reservas",
  "Manual",
  "Site",
  "Indicação",
  "Campanha local",
] as const;

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CUSTOMER_NAME_LOWERCASE_PARTICLES = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

function capitalizeCustomerNamePart(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatCustomerName(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((part, index) => {
      if (index > 0 && CUSTOMER_NAME_LOWERCASE_PARTICLES.has(part)) {
        return part;
      }

      return capitalizeCustomerNamePart(part);
    })
    .join(" ");
}

export function normalizeCustomerName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeBrazilianMobilePhone(value: string | null | undefined) {
  return normalizeBrazilianMobilePhoneWithMeta(value).normalized;
}

export function normalizeBrazilianMobilePhoneWithMeta(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (!digits) {
    return {
      normalized: null,
      wasCorrected: false,
      originalDigits: digits,
    };
  }

  let normalized = digits;

  if (normalized.startsWith("55") && (normalized.length === 12 || normalized.length === 13)) {
    normalized = normalized.slice(2);
  }

  if (normalized.length === 10) {
    normalized = `${normalized.slice(0, 2)}9${normalized.slice(2)}`;
  }

  if (normalized.length !== 11) {
    return {
      normalized: null,
      wasCorrected: false,
      originalDigits: digits,
    };
  }

  const ddd = normalized.slice(0, 2);

  if (!/^[1-9]{2}$/.test(ddd)) {
    return {
      normalized: null,
      wasCorrected: false,
      originalDigits: digits,
    };
  }

  if (normalized.charAt(2) !== "9") {
    return {
      normalized: null,
      wasCorrected: false,
      originalDigits: digits,
    };
  }

  return {
    normalized,
    wasCorrected: normalized !== digits,
    originalDigits: digits,
  };
}

export function normalizeEmail(value: string | null | undefined) {
  return normalizeEmailWithMeta(value).normalized;
}

export function normalizeEmailWithMeta(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized || normalized === "null") {
    return {
      normalized: null,
      wasInvalidConverted: false,
      originalValue: value ?? null,
    };
  }

  const isValid = BASIC_EMAIL_REGEX.test(normalized);

  return {
    normalized: isValid ? normalized : null,
    wasInvalidConverted: !isValid,
    originalValue: value ?? null,
  };
}

export function normalizeCustomerPhone(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/\D/g, "");
  return normalized || null;
}

export function normalizeCustomerSource(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}
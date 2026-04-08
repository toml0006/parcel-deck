import { format, formatDistanceToNowStrict, isToday, isTomorrow } from "date-fns";

export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function formatCompactDate(value?: Date | string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  }

  if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, "h:mm a")}`;
  }

  return format(date, "EEE, MMM d");
}

export function formatRelative(value?: Date | string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function formatOptionalText(value?: string | null, fallback = "Unknown") {
  if (!value?.trim()) {
    return fallback;
  }

  return value;
}

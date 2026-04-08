const allowedSources = ["openclaw_email", "manual", "import"] as const;

export type ParcelDeckSource = (typeof allowedSources)[number];

export type ParcelDeckPluginConfig = {
  baseUrl: string;
  defaultSource: ParcelDeckSource;
  sharedSecret: string;
  timeoutMs: number;
};

export function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function resolveParcelDeckConfig(
  pluginConfig: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
): ParcelDeckPluginConfig {
  const baseUrlValue =
    typeof pluginConfig?.baseUrl === "string" && pluginConfig.baseUrl.trim()
      ? pluginConfig.baseUrl
      : env.PARCEL_DECK_URL;
  const sharedSecretValue =
    typeof pluginConfig?.sharedSecret === "string" && pluginConfig.sharedSecret.trim()
      ? pluginConfig.sharedSecret
      : env.PARCEL_DECK_SHARED_SECRET;
  const timeoutValue =
    typeof pluginConfig?.timeoutMs === "number" && Number.isFinite(pluginConfig.timeoutMs)
      ? pluginConfig.timeoutMs
      : Number(env.PARCEL_DECK_TIMEOUT_MS ?? 15000);
  const defaultSourceValue =
    typeof pluginConfig?.defaultSource === "string"
      ? pluginConfig.defaultSource
      : env.PARCEL_DECK_DEFAULT_SOURCE;

  if (!baseUrlValue) {
    throw new Error("Parcel Deck plugin requires config.baseUrl or PARCEL_DECK_URL.");
  }

  if (!sharedSecretValue) {
    throw new Error(
      "Parcel Deck plugin requires config.sharedSecret or PARCEL_DECK_SHARED_SECRET.",
    );
  }

  const baseUrl = normalizeBaseUrl(baseUrlValue);

  try {
    new URL(baseUrl);
  } catch {
    throw new Error(`Parcel Deck baseUrl is invalid: ${baseUrlValue}`);
  }

  const defaultSource = allowedSources.includes(defaultSourceValue as ParcelDeckSource)
    ? (defaultSourceValue as ParcelDeckSource)
    : "openclaw_email";

  return {
    baseUrl,
    defaultSource,
    sharedSecret: sharedSecretValue,
    timeoutMs: timeoutValue >= 1000 ? timeoutValue : 15000,
  };
}

export async function parcelDeckRequest(
  config: ParcelDeckPluginConfig,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${config.sharedSecret}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const bodyText = await response.text();
  let parsedBody: unknown = null;

  try {
    parsedBody = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsedBody = bodyText;
  }

  if (!response.ok) {
    throw new Error(
      `Parcel Deck request failed (${response.status} ${response.statusText}): ${
        typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody)
      }`,
    );
  }

  return parsedBody;
}

export function buildShipmentQuery(params: {
  active?: boolean;
  q?: string;
  status?: string;
}) {
  const query = new URLSearchParams();

  if (typeof params.active === "boolean") {
    query.set("active", String(params.active));
  }

  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }

  if (params.status?.trim()) {
    query.set("status", params.status.trim());
  }

  const serialized = query.toString();

  return serialized ? `?${serialized}` : "";
}

export function formatToolResult(toolName: string, payload: unknown) {
  return `${toolName} result\n${JSON.stringify(payload, null, 2)}`;
}

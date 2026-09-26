/**
 * "PulseQL" is not a real backend query language — GET /logs only accepts
 * a fixed set of query params (type, env, appName, search, range, limit,
 * from, to). This parses the editor's `key:value` shorthand into exactly
 * those params, entirely client-side.
 *
 * Deliberately NOT used: the backend's own `?query=<string>` shorthand
 * (AppLogsService.parseFilters). It calls `queryObj.split(...)` on the
 * request's query object instead of the raw string, which throws and
 * turns the whole request into a 500. Sending discrete params (as this
 * parser does) skips that code path entirely.
 */

export type ParsedQuery = {
  params: {
    type?: string;
    env?: string;
    appName?: string;
    search?: string;
    range?: string;
    limit?: number;
    from?: number;
    to?: number;
  };
  chips: { label: string; value: string }[];
  warnings: string[];
};

const FIELD_ALIASES: Record<string, keyof ParsedQuery["params"] | "search"> = {
  type: "type",
  level: "type",
  env: "env",
  environment: "env",
  app: "appName",
  appname: "appName",
  service: "appName",
  search: "search",
  message: "search",
  msg: "search",
  range: "range",
  limit: "limit",
  from: "from",
  to: "to",
};

const RANGE_PATTERN = /^\d+[smhd]$/i;
const MAX_LIMIT = 500;

export function parsePulseQL(input: string): ParsedQuery {
  const params: ParsedQuery["params"] = {};
  const warnings: string[] = [];
  const freeText: string[] = [];
  const seenKeys = new Set<string>();

  const tokenPattern = /([\w-]+):"([^"]*)"|([\w-]+):(\S+)|"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(input)) !== null) {
    const [, qKey, qVal, kKey, kVal, phrase, bare] = match;
    const key = qKey ?? kKey;
    const value = qVal ?? kVal;

    if (key !== undefined && value !== undefined) {
      const field = FIELD_ALIASES[key.toLowerCase()];
      if (!field) {
        warnings.push(`Unknown field "${key}" — ignored`);
        continue;
      }
      if (field === "search") {
        freeText.push(value);
        continue;
      }
      if (field === "range") {
        if (!RANGE_PATTERN.test(value)) {
          warnings.push(
            `Invalid range "${value}" — expected a number plus s/m/h/d, e.g. 24h`,
          );
          continue;
        }
        if (seenKeys.has("range")) warnings.push('Multiple "range:" values — using the last one');
        params.range = value.toLowerCase();
        seenKeys.add("range");
        continue;
      }
      if (field === "limit") {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) {
          warnings.push(`Invalid limit "${value}" — ignored`);
          continue;
        }
        params.limit = Math.min(Math.floor(n), MAX_LIMIT);
        if (n > MAX_LIMIT) warnings.push(`limit capped at ${MAX_LIMIT}`);
        continue;
      }
      if (field === "from" || field === "to") {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          warnings.push(`Invalid ${field} "${value}" — ignored`);
          continue;
        }
        params[field] = n;
        continue;
      }
      // type / env / appName
      if (seenKeys.has(field)) {
        warnings.push(`Multiple "${key}:" values — using the last one`);
      }
      params[field] = value;
      seenKeys.add(field);
      continue;
    }

    const word = phrase ?? bare;
    if (!word) continue;
    const upper = word.toUpperCase();
    if (upper === "AND") continue;
    if (upper === "OR" || upper === "NOT") {
      if (!warnings.some((w) => w.startsWith("OR/NOT")))
        warnings.push(
          `OR/NOT aren't supported by the API — all terms are combined with AND`,
        );
      continue;
    }
    freeText.push(word);
  }

  if (freeText.length) {
    params.search = freeText.join(" ").trim() || undefined;
  }

  const chips: { label: string; value: string }[] = [];
  if (params.type) chips.push({ label: "type", value: params.type });
  if (params.env) chips.push({ label: "env", value: params.env });
  if (params.appName) chips.push({ label: "app", value: params.appName });
  if (params.range) chips.push({ label: "range", value: params.range });
  if (params.limit) chips.push({ label: "limit", value: String(params.limit) });
  if (params.from) chips.push({ label: "from", value: String(params.from) });
  if (params.to) chips.push({ label: "to", value: String(params.to) });
  if (params.search) chips.push({ label: "search", value: params.search });

  return { params, chips, warnings };
}

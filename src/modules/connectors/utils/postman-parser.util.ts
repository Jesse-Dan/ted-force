import {
  ConnectorEnvRef,
  ConnectorOperation,
  ConnectorOperationParam,
} from "../../../entities/agent-connector.entity";
import { ConnectorHttpMethod } from "../../../entities/enums/connector-http-method.enum";

type PostmanParseResult = {
  rawImport: Record<string, unknown>;
  operations: ConnectorOperation[];
  graph: {
    nodes: string[];
    edges: Array<{ from: string; to: string }>;
  };
  warnings: string[];
  extractedEnvKeys: string[];
};

export function parsePostmanCollection(input: {
  collectionText?: string;
  collectionObject?: Record<string, unknown> | null;
}): PostmanParseResult {
  const rawImport = parseCollectionObject(input);
  const warnings: string[] = [];
  const operations: ConnectorOperation[] = [];
  const requests = flattenRequests(asArray(rawImport.item));
  const seenIds = new Set<string>();
  const extractedVariables = new Set<string>();

  for (const requestItem of requests) {
    const request = ensureRecord(requestItem.request);
    const method = parseHttpMethod(request.method);
    const name = readString(requestItem.name) || "Imported endpoint";
    const url = readRequestUrl(request.url);
    const headers = parseHeaders(request.header);
    const bodySchema = parseBodySchema(request.body);
    const params = parseUrlParams(url, request.url);
    const operationId = ensureUniqueId(`${method}_${name}`, seenIds);
    const description =
      readDescription(request.description) ||
      readDescription(requestItem.description) ||
      `${method} ${url || "/"} imported from Postman`;
    const isDestructive = method !== ConnectorHttpMethod.GET;

    for (const variable of extractVariables(url)) {
      extractedVariables.add(variable);
    }
    for (const value of Object.values(headers)) {
      for (const variable of extractVariables(value)) {
        extractedVariables.add(variable);
      }
    }
    for (const variable of extractVariables(JSON.stringify(bodySchema ?? {}))) {
      extractedVariables.add(variable);
    }

    const envRefs: ConnectorEnvRef[] = [...extractedVariables].map((key) => ({
      field: "dynamic",
      env_key: key,
    }));

    operations.push({
      id: operationId,
      name,
      method,
      path: url || "/",
      url: url || "/",
      description,
      parameters: params,
      requestBodySchema: bodySchema,
      bodySchema,
      headers,
      env_refs: envRefs,
      isDestructive,
      isExposed: !isDestructive,
      permissionLevel: isDestructive ? "needs_approval" : "always_allow",
    });
  }

  if (!operations.length) {
    warnings.push("No requests were found in the Postman collection.");
  }

  return {
    rawImport,
    operations,
    graph: {
      nodes: operations.map((operation) => operation.id),
      edges: [],
    },
    warnings,
    extractedEnvKeys: [...extractedVariables],
  };
}

function parseCollectionObject(input: {
  collectionText?: string;
  collectionObject?: Record<string, unknown> | null;
}): Record<string, unknown> {
  if (input.collectionObject && typeof input.collectionObject === "object") {
    return input.collectionObject;
  }

  const raw = String(input.collectionText ?? "").trim();
  if (!raw) {
    throw new Error("Postman collection is required.");
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Postman collection must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to parse Postman JSON: ${
        error instanceof Error ? error.message : "Invalid JSON."
      }`,
    );
  }
}

function flattenRequests(
  items: unknown[],
  acc: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> {
  for (const item of items) {
    const record = ensureRecord(item);
    const request = ensureRecord(record.request);
    if (Object.keys(request).length > 0) {
      acc.push(record);
    }

    const children = asArray(record.item);
    if (children.length > 0) {
      flattenRequests(children, acc);
    }
  }

  return acc;
}

function parseHttpMethod(value: unknown): ConnectorHttpMethod {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (Object.values(ConnectorHttpMethod).includes(normalized as ConnectorHttpMethod)) {
    return normalized as ConnectorHttpMethod;
  }
  return ConnectorHttpMethod.GET;
}

function parseHeaders(value: unknown): Record<string, string> {
  const headers = asArray(value);
  return headers.reduce<Record<string, string>>((acc, headerValue) => {
    const header = ensureRecord(headerValue);
    const key = readString(header.key);
    const headerValueText = readString(header.value);
    if (!key || !headerValueText) {
      return acc;
    }
    acc[key] = headerValueText;
    return acc;
  }, {});
}

function parseBodySchema(value: unknown): Record<string, unknown> | null {
  const body = ensureRecord(value);
  const mode = String(body.mode ?? "").toLowerCase();
  if (mode === "raw") {
    const raw = readString(body.raw);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { raw };
    }
  }

  if (Array.isArray(body.urlencoded)) {
    return {
      urlencoded: body.urlencoded,
    };
  }

  if (Array.isArray(body.formdata)) {
    return {
      formdata: body.formdata,
    };
  }

  return null;
}

function parseUrlParams(
  rawUrl: string | null,
  structuredUrl: unknown,
): ConnectorOperationParam[] {
  const params: ConnectorOperationParam[] = [];
  const seen = new Set<string>();

  if (rawUrl) {
    const pathMatches = [...rawUrl.matchAll(/\{([^{}]+)\}|:([a-zA-Z0-9_]+)/g)];
    for (const match of pathMatches) {
      const name = String(match[1] ?? match[2] ?? "").trim();
      if (!name || seen.has(`path:${name}`)) {
        continue;
      }
      params.push({
        name,
        in: "path",
        type: "string",
        description: `Path variable "${name}"`,
        required: true,
      });
      seen.add(`path:${name}`);
    }

    try {
      const normalized = rawUrl.startsWith("http")
        ? rawUrl
        : `https://example.com${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
      const url = new URL(normalized);
      for (const key of new Set(url.searchParams.keys())) {
        if (seen.has(`query:${key}`)) {
          continue;
        }
        params.push({
          name: key,
          in: "query",
          type: "string",
          description: `Query parameter "${key}"`,
          required: false,
        });
        seen.add(`query:${key}`);
      }
    } catch {
      // ignore URL parse failures
    }
  }

  const urlObject = ensureRecord(structuredUrl);
  const variables = asArray(urlObject.variable);
  for (const variableValue of variables) {
    const variable = ensureRecord(variableValue);
    const key = readString(variable.key);
    if (!key || seen.has(`path:${key}`)) {
      continue;
    }
    params.push({
      name: key,
      in: "path",
      type: "string",
      description: `Path variable "${key}"`,
      required: true,
    });
    seen.add(`path:${key}`);
  }

  return params;
}

function readRequestUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  const url = ensureRecord(value);
  const raw = readString(url.raw);
  if (raw) {
    return raw;
  }

  const host = asArray(url.host).map((entry) => String(entry ?? "").trim()).filter(Boolean);
  const path = asArray(url.path).map((entry) => String(entry ?? "").trim()).filter(Boolean);
  if (!host.length && !path.length) {
    return null;
  }

  const prefix = host.length ? `https://${host.join(".")}` : "";
  const suffix = path.length ? `/${path.join("/")}` : "";
  return `${prefix}${suffix}` || null;
}

function readDescription(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  const record = ensureRecord(value);
  const content = readString(record.content);
  return content || null;
}

function extractVariables(value: string | null): string[] {
  if (!value) {
    return [];
  }
  const tokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
  const keys = new Set<string>();
  for (const match of value.matchAll(tokenPattern)) {
    const key = String(match[1] ?? "").trim();
    if (key) {
      keys.add(key);
    }
  }
  return [...keys];
}

function ensureUniqueId(raw: string, seen: Set<string>): string {
  const base = slugify(raw, "_") || "postman_operation";
  let candidate = base;
  let counter = 2;
  while (seen.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }
  seen.add(candidate);
  return candidate;
}

function slugify(value: string, separator = "-"): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}+`, "g"), separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
}

function ensureRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

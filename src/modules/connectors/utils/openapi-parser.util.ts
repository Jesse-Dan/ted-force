import {
  ConnectorOperation,
  ConnectorOperationParam,
  ConnectorPermissionLevel,
} from "../../../entities/agent-connector.entity";
import { ConnectorHttpMethod } from "../../../entities/enums/connector-http-method.enum";

type OpenApiParseResult = {
  rawImport: Record<string, unknown>;
  operations: ConnectorOperation[];
  graph: {
    nodes: string[];
    edges: Array<{ from: string; to: string }>;
  };
  warnings: string[];
};

const SUPPORTED_METHODS: Record<string, ConnectorHttpMethod> = {
  get: ConnectorHttpMethod.GET,
  post: ConnectorHttpMethod.POST,
  put: ConnectorHttpMethod.PUT,
  patch: ConnectorHttpMethod.PATCH,
  delete: ConnectorHttpMethod.DELETE,
};

export function parseOpenApiSpec(input: {
  specText?: string;
  specObject?: Record<string, unknown> | null;
}): OpenApiParseResult {
  const warnings: string[] = [];
  const rawImport = parseSpecObject(input);
  const operations: ConnectorOperation[] = [];
  const usedIds = new Set<string>();
  const baseUrl = readPrimaryServerUrl(rawImport);
  const paths = ensureRecord(rawImport.paths);

  for (const [path, pathValue] of Object.entries(paths)) {
    const pathObject = ensureRecord(pathValue);
    const pathParameters = asArray(pathObject.parameters);

    for (const [methodKey, methodValue] of Object.entries(pathObject)) {
      const method = SUPPORTED_METHODS[methodKey.toLowerCase()];
      if (!method) {
        continue;
      }

      const operationObject = ensureRecord(methodValue);
      const explicitId = readString(operationObject.operationId);
      const operationId = ensureUniqueId(
        explicitId || `${method.toLowerCase()}_${path}`,
        usedIds,
      );
      const operationName =
        readString(operationObject.summary) ||
        readString(operationObject.operationId) ||
        buildNameFromPath(method, path);
      const description = enrichDescription({
        method,
        path,
        summary: readString(operationObject.summary),
        description: readString(operationObject.description),
      });
      const parameters = parseOperationParams(
        pathParameters,
        asArray(operationObject.parameters),
      );
      const requestBodySchema = parseRequestBodySchema(operationObject.requestBody);
      const dependsOn = parseDependsOn(operationObject["x-dependsOn"]);
      const isDestructive = isDestructiveMethod(method);
      const permissionLevel: ConnectorPermissionLevel = isDestructive
        ? "needs_approval"
        : "always_allow";

      operations.push({
        id: operationId,
        name: operationName,
        method,
        path,
        url: buildUrl(baseUrl, path),
        description,
        parameters,
        requestBodySchema,
        bodySchema: requestBodySchema,
        headers: {},
        dependsOn,
        isDestructive,
        isExposed: !isDestructive,
        permissionLevel,
      });
    }
  }

  if (!operations.length) {
    warnings.push("No callable operations were discovered in this OpenAPI spec.");
  }

  return {
    rawImport,
    operations,
    graph: buildGraph(operations),
    warnings,
  };
}

function parseSpecObject(input: {
  specText?: string;
  specObject?: Record<string, unknown> | null;
}): Record<string, unknown> {
  if (input.specObject && typeof input.specObject === "object") {
    return input.specObject;
  }

  const raw = String(input.specText ?? "").trim();
  if (!raw) {
    throw new Error("OpenAPI spec is required.");
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback to YAML parsing.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require("js-yaml") as { load: (value: string) => unknown };
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    throw new Error(
      `Failed to parse OpenAPI spec: ${
        error instanceof Error ? error.message : "Invalid format."
      }`,
    );
  }

  throw new Error("OpenAPI spec could not be parsed.");
}

function parseOperationParams(
  pathParameters: unknown[],
  operationParameters: unknown[],
): ConnectorOperationParam[] {
  const merged = [...pathParameters, ...operationParameters];
  return merged
    .map((candidate) => parseParam(candidate))
    .filter((candidate): candidate is ConnectorOperationParam => Boolean(candidate));
}

function parseParam(candidate: unknown): ConnectorOperationParam | null {
  const value = ensureRecord(candidate);
  const name = readString(value.name);
  const locationRaw = readString(value.in)?.toLowerCase() ?? "query";
  const schema = ensureRecord(value.schema);
  if (!name) {
    return null;
  }

  const location =
    locationRaw === "path" ||
    locationRaw === "query" ||
    locationRaw === "header" ||
    locationRaw === "body"
      ? locationRaw
      : "query";

  const type = readString(schema.type) || inferSchemaType(schema) || "string";
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean)
    : undefined;

  return {
    name,
    in: location,
    type,
    description:
      readString(value.description) ||
      `Input "${name}" used in the ${location} scope.`,
    required: Boolean(value.required) || location === "path",
    ...(enumValues?.length ? { enum: enumValues } : {}),
  };
}

function parseRequestBodySchema(
  requestBodyValue: unknown,
): Record<string, unknown> | null {
  const requestBody = ensureRecord(requestBodyValue);
  const content = ensureRecord(requestBody.content);
  if (!Object.keys(content).length) {
    return null;
  }

  const preferredTypes = [
    "application/json",
    "application/*+json",
    ...Object.keys(content),
  ];

  for (const mediaType of preferredTypes) {
    const media = ensureRecord(content[mediaType]);
    const schema = ensureRecord(media.schema);
    if (Object.keys(schema).length > 0) {
      return schema;
    }
  }

  return null;
}

function parseDependsOn(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const parsed = value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}

function buildGraph(operations: ConnectorOperation[]) {
  const operationIds = new Set(operations.map((operation) => operation.id));
  const edges: Array<{ from: string; to: string }> = [];

  for (const operation of operations) {
    for (const dependency of operation.dependsOn ?? []) {
      if (operationIds.has(dependency)) {
        edges.push({
          from: dependency,
          to: operation.id,
        });
      }
    }
  }

  return {
    nodes: operations.map((operation) => operation.id),
    edges,
  };
}

function readPrimaryServerUrl(spec: Record<string, unknown>): string | null {
  const servers = asArray(spec.servers);
  for (const server of servers) {
    const url = readString(ensureRecord(server).url);
    if (url) {
      return url.replace(/\/+$/, "");
    }
  }
  return null;
}

function buildUrl(baseUrl: string | null, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

function enrichDescription(input: {
  method: ConnectorHttpMethod;
  path: string;
  summary?: string | null;
  description?: string | null;
}): string {
  const verbIntent =
    input.method === ConnectorHttpMethod.GET
      ? "Retrieve data"
      : input.method === ConnectorHttpMethod.DELETE
        ? "Delete data"
        : "Write data";

  const candidate = (input.description || input.summary || "").trim();
  if (candidate) {
    return candidate;
  }

  return `${verbIntent} via ${input.method} ${input.path}.`;
}

function buildNameFromPath(method: ConnectorHttpMethod, path: string): string {
  const readablePath = path
    .replace(/[{}:]/g, "")
    .split("/")
    .filter(Boolean)
    .join(" ");
  return `${method} ${readablePath || "endpoint"}`.trim();
}

function ensureUniqueId(raw: string, usedIds: Set<string>): string {
  const base = slugify(raw, "_") || "operation";
  let candidate = base;
  let counter = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function isDestructiveMethod(method: ConnectorHttpMethod): boolean {
  return method !== ConnectorHttpMethod.GET;
}

function inferSchemaType(schema: Record<string, unknown>): string | null {
  if (schema.type && typeof schema.type === "string") {
    return schema.type;
  }
  if (Array.isArray(schema.enum)) {
    return "string";
  }
  if (schema.properties && typeof schema.properties === "object") {
    return "object";
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function ensureRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(value: string, separator = "-"): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}+`, "g"), separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
}

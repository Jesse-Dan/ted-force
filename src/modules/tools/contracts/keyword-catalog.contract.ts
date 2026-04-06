import { KeywordContract } from "./keyword.contract";

export const keywordCatalog: KeywordContract[] = [
  {
    name: "HTTP",
    description:
      "Provides methods to make HTTP requests such as GET, POST, PUT, and DELETE to interact with remote servers or APIs.",
    tags: ["http", "requests", "API", "network", "data-access"],
    variants: [
      {
        name: "HTTP.get(url, params, headers)",
        tags: ["http", "get", "read", "fetch", "api"],
        description:
          "Sends an HTTP GET request to the specified URL with optional query parameters (`params`) and optional `headers` to retrieve data from a server.",
      },
      {
        name: "HTTP.post(url, data, headers)",
        tags: ["http", "post", "create", "send", "api"],
        description:
          "Sends an HTTP POST request to the specified URL with a request body (`data`) and optional `headers` to create a new resource on the server.",
      },
      {
        name: "HTTP.put(url, data, headers)",
        tags: ["http", "put", "update", "replace", "api"],
        description:
          "Sends an HTTP PUT request to the specified URL with the full resource (`data`) and optional `headers` to update or replace an existing resource.",
      },
      {
        name: "HTTP.delete(url, headers)",
        tags: ["http", "delete", "remove", "destroy", "api"],
        description:
          "Sends an HTTP DELETE request to the specified URL with optional `headers` to delete a resource on the server.",
      },
    ],
  },
  {
    name: "ENV",
    description:
      "Provides access to environment variables, which store configuration values that may vary between environments (e.g., dev, prod).",
    tags: ["env", "configuration", "variables", "settings", "environment"],
    variants: [
      {
        name: "ENV.get('<key>')",
        tags: ["env", "get", "read", "config", "environment"],
        description:
          "Retrieves the value of an environment variable specified by `<key>`.",
      },
    ],
  },
  {
    name: "MEMORY",
    description:
      "Provides temporary in-memory key-value storage for runtime use, such as caching or passing state between function calls. Supports auto-creation of memory if it doesn't exist.",
    tags: ["memory", "cache", "store", "temporary", "state"],
    variants: [
      {
        name: "await MEMORY.get('<key>')",
        tags: ["memory", "get", "read", "state", "cache"],
        description:
          "Asynchronously retrieves the value associated with the given `<key>` from in-memory storage. Throws an error if the key does not exist.",
        exampleCode: "const value = await MEMORY.get('<key>');",
      },
      {
        name: "await MEMORY.add('<key>', {})",
        tags: ["memory", "add", "write", "store", "cache"],
        description:
          "Asynchronously adds a value to memory under the given `<key>`. If the key exists, its value will be merged or overwritten. Memory is auto-created if it does not exist.",
        exampleCode: "await MEMORY.add('<key>', { value: args.value });",
      },
      {
        name: "await MEMORY.getOrCreate('<key>', {})",
        tags: ["memory", "get", "read", "state", "cache", "update"],
        description:
          "Asynchronously retrieves the value associated with the given `<key>` from in-memory storage. If the key does not exist, it will be created with an empty value.",
        exampleCode: "const cache = await MEMORY.getOrCreate('<key>', {});",
      },
      {
        name: "await MEMORY.update('<key>', {})",
        tags: ["memory", "update", "write", "store", "cache"],
        description:
          "Asynchronously updates the value for an existing key in memory. Throws an error if the key or memory record does not exist.",
        exampleCode: "await MEMORY.update('<key>', { status: 'updated' });",
      },
      {
        name: "await MEMORY.remove('<key>')",
        tags: ["memory", "delete", "remove", "clear", "state"],
        description:
          "Asynchronously removes the value associated with the given `<key>` from memory.",
        exampleCode: "await MEMORY.remove('<key>');",
      },
      {
        name: "await MEMORY.clear()",
        tags: ["memory", "clear", "reset", "state"],
        description:
          "Asynchronously clears all memory data for the current tuul context, resetting it to an empty object.",
        exampleCode: "await MEMORY.clear();",
      },
      {
        name: "await MEMORY.getBySharedMemoryId('<sharedMemoryId>')",
        tags: ["memory", "shared", "get", "read", "state"],
        description:
          "Asynchronously retrieves the memory record associated with a specific `sharedMemoryId`. Useful for shared contexts across multiple tuuls.",
        exampleCode:
          "const sharedMemory = await MEMORY.getBySharedMemoryId('<sharedMemoryId>');",
      },
    ],
  },
  {
    name: "AWARENESS",
    description:
      "Enables contextual awareness — allows the AI to detect, recall, and adapt to the current user, session, or conversation state. Used to build continuity, personalize responses, or adapt decisions dynamically.",
    tags: ["awareness", "context", "state", "memory", "session", "adaptive"],
    variants: [
      {
        name: "await AWARENESS.getContext()",
        tags: ["awareness", "context", "read", "state"],
        description:
          "Retrieves the current context object, including user identity, recent actions, or environment state.",
        exampleCode: "const awareness = await AWARENESS.getContext();",
      },
      {
        name: "await AWARENESS.updateContext([])",
        tags: ["awareness", "context", "update", "state"],
        description:
          "Updates or enriches the active context so the AI can maintain continuity or adjust behavior based on new information.",
        exampleCode:
          "await AWARENESS.updateContext([\n  'User prefers concise summaries',\n  `Last lookup was for ${args.query}`,\n]);",
      },
      {
        name: "await AWARENESS.clearContext()",
        tags: ["awareness", "context", "reset", "memory"],
        description:
          "Clears all awareness data for the active session, resetting the contextual state.",
        exampleCode: "await AWARENESS.clearContext();",
      },
    ],
  },
  {
    name: "FUNCTION",
    description:
      "Allows calling predefined or user-defined backend functions with optional input parameters.",
    tags: ["function", "execute", "call", "backend", "actions"],
    variants: [
      {
        name: "FUNCTION.call({ name: '<key>',  arguments: {} })",
        tags: ["function", "execute", "invoke", "call", "action"],
        description:
          "Invokes another enabled user-created tool in the same agent. The supplied `arguments` are validated against that tool's schema before execution.",
        exampleCode:
          "const response = await FUNCTION.call({\n  name: '<key>',\n  arguments: {\n    id: args.id,\n  },\n});",
      },
    ],
  },
  {
    name: "LOG",
    description:
      "Provides methods to log messages at various levels (log, info, warn, error, debug) with optional data payloads. Useful for tracking execution details and debugging.",
    tags: ["log", "logging", "debug", "info", "warn", "error", "trace"],
    variants: [
      {
        name: "LOG.log(message, data?)",
        tags: ["log", "write", "debug"],
        description: "Writes a general log entry with an optional data payload.",
      },
      {
        name: "LOG.info(message, data?)",
        tags: ["info", "write", "debug"],
        description: "Writes an info-level log entry with an optional data payload.",
      },
      {
        name: "LOG.warn(message, data?)",
        tags: ["warn", "write", "debug"],
        description: "Writes a warning-level log entry with an optional data payload.",
      },
      {
        name: "LOG.error(message, data?)",
        tags: ["error", "write", "debug"],
        description: "Writes an error-level log entry with an optional data payload.",
      },
      {
        name: "LOG.debug(message, data?)",
        tags: ["debug", "write", "trace"],
        description: "Writes a debug-level log entry with an optional data payload.",
      },
      {
        name: "LOG.getLogs()",
        tags: ["log", "read", "fetch", "debug"],
        description: "Retrieves all accumulated log entries.",
      },
    ],
  },
  {
    name: "DATASOURCE",
    description:
      "Provides methods to interact with external databases and data services like MySQL, PostgreSQL, Supabase, or Firebase.",
    tags: ["datasource", "database", "query", "SQL", "firebase"],
    variants: [
      {
        name: "DATASOURCE('<tuul-id>').mysql().query('<query>')",
        tags: ["mysql", "sql", "database", "query"],
        description:
          "Executes a SQL query on a MySQL database and returns the result.",
      },
      {
        name: "DATASOURCE('<tuul-id>').pgsql().query('<query>')",
        tags: ["pgsql", "postgresql", "sql", "database", "query"],
        description:
          "Executes a SQL query on a PostgreSQL database and returns the result.",
      },
    ],
  },
  {
    name: "PLATFORM",
    description:
      "Provides built-in Tuul platform tools that allow agents to interact with the web, run code, analyze data, and access real-world services. Unlike `FUNCTION`, these tools are predefined and available to all agents.",
    tags: ["platform", "tools", "integration", "tuul", "runtime", "external"],
    variants: [
      {
        name: "await PLATFORM.web_search('<query>')",
        tags: ["web", "search", "internet", "data"],
        description:
          "Performs a real-time web search and returns summarized results with source links.",
      },
      {
        name: "await PLATFORM.fact_check({ claim })",
        tags: ["fact", "validation", "verify"],
        description:
          "Validates a factual statement using trusted sources and returns whether it’s true with corrections if necessary.",
      },
      {
        name: "await PLATFORM.code_run({ language, code })",
        tags: ["code", "execution", "sandbox"],
        description:
          "Executes code securely within a sandboxed runtime (supports JavaScript, Python, SQL).",
      },
      {
        name: "await PLATFORM.file_parse({ file, extract })",
        tags: ["file", "parse", "document"],
        description:
          "Extracts data from structured or unstructured files (PDF, CSV, DOCX, TXT).",
      },
      {
        name: "await PLATFORM.translate({ text, to })",
        tags: ["translate", "language"],
        description:
          "Translates text into another language while preserving tone and context.",
      },
      {
        name: "await PLATFORM.summarize({ text, style, length })",
        tags: ["summarize", "text"],
        description:
          "Generates a concise summary of text in bullet or narrative format.",
      },
      {
        name: "await PLATFORM.analyze_sentiment({ text })",
        tags: ["sentiment", "emotion", "nlp"],
        description:
          "Analyzes the emotional tone and intent of text, returning mood and confidence level.",
      },
      {
        name: "await PLATFORM.web_scrape({ url, selectors })",
        tags: ["scrape", "html", "crawler"],
        description:
          "Extracts structured data from web pages using CSS selectors.",
      },
      {
        name: "await PLATFORM.generate_image({ prompt, size })",
        tags: ["image", "generation", "media"],
        description:
          "Creates AI-generated images or visual concepts from text descriptions.",
      },
      {
        name: "await PLATFORM.speech_to_text({ audio })",
        tags: ["audio", "speech", "voice"],
        description:
          "Converts recorded or streamed speech audio into text transcription.",
      },
      {
        name: "await PLATFORM.text_to_speech({ text, voice })",
        tags: ["audio", "speech", "tts"],
        description: "Converts text into natural-sounding spoken audio output.",
      },
    ],
  },
];

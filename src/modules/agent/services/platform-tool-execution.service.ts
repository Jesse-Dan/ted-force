import { Service, Autowired } from "fragment-ts";
import { load } from "cheerio";
import type { PlatformTool } from "../../../entities/platform-tool.entity";
import { FirebaseViewLogService } from "../../../core/logging/services/firebase-view-log.service";
import { FileParserService } from "../../files/services/file-parser.service";

export interface PlatformToolExecutionContext {
  agentId: string;
  sessionId: string;
}

@Service()
export class PlatformToolExecutionService {
  @Autowired()
  private firebaseViewLog!: FirebaseViewLogService;

  @Autowired()
  private fileParserService!: FileParserService;

  async execute(
    platformTool: PlatformTool,
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    await this.firebaseViewLog.toolCall(
      context.agentId,
      context.sessionId,
      `Platform tool invoked: ${platformTool.key}`,
      {
        toolKey: platformTool.key,
        args,
      },
    );

    switch (platformTool.key) {
      case "web_search":
        return this.webSearch(args, context);
      case "fact_check":
        return this.factCheck(args, context);
      case "code_run":
        return this.codeRun(args, context);
      case "web_scrape":
        return this.webScrape(args, context);
      case "summarize":
        return this.summarize(args, context);
      case "analyze_sentiment":
        return this.analyzeSentiment(args, context);
      case "file_parse":
        return this.fileParse(args, context);
      case "translate":
      case "generate_image":
      case "speech_to_text":
      case "text_to_speech":
        throw new Error(
          `Platform tool ${platformTool.key} requires a dedicated runtime and is not configured yet.`,
        );

      default:
        throw new Error(`Platform tool ${platformTool.key} is not implemented yet.`);
    }
  }

  private async fetchOrThrow(input: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(input, init);
    } catch (error) {
      throw new Error(
        `Network request failed for ${init?.method ?? "GET"} ${input}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async webSearch(
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    const query = String(args.query ?? "").trim();
    const maxResults = Math.max(1, Math.min(Number(args.max_results ?? 5) || 5, 10));

    if (!query) {
      throw new Error("web_search requires a query.");
    }

    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
      throw new Error("SERPER_API_KEY is not configured.");
    }

    const response = await this.fetchOrThrow("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query }),
    });

    if (!response.ok) {
      throw new Error(`web_search failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const organic = Array.isArray(payload.organic)
      ? (payload.organic as Array<Record<string, unknown>>).slice(0, maxResults)
      : [];

    await this.firebaseViewLog.executionLog(
      context.agentId,
      context.sessionId,
      "Platform tool execution succeeded",
      {
        toolKey: "web_search",
        query,
      },
    );

    return {
      widget: "search_results",
      ...payload,
      organic,
    };
  }

  private async factCheck(
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    const claim = String(args.claim ?? "").trim();

    if (!claim) {
      throw new Error("fact_check requires a claim.");
    }

    const search = (await this.webSearch({ query: claim, max_results: 5 }, context)) as {
      organic?: Array<Record<string, unknown>>;
    };

    const evidence = (search.organic ?? []).map((entry) => ({
      title: entry.title ?? null,
      link: entry.link ?? null,
      snippet: entry.snippet ?? null,
    }));

    return {
      widget: "fact_check",
      claim,
      verdict: evidence.length > 0 ? "unverified" : "no-evidence",
      confidence: evidence.length > 0 ? 0.45 : 0,
      evidence,
    };
  }

  private async codeRun(
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    const language = String(args.language ?? "javascript").trim().toLowerCase();
    const code = String(args.code ?? "");

    if (!code.trim()) {
      throw new Error("code_run requires code.");
    }

    if (!["js", "javascript", "ts", "typescript"].includes(language)) {
      throw new Error(
        `code_run only supports JavaScript/TypeScript right now. Received ${language}.`,
      );
    }

    const runner = new Function(
      `
        return (async () => {
          ${code}
        })();
      `,
    );

    const result = await runner();

    await this.firebaseViewLog.executionLog(
      context.agentId,
      context.sessionId,
      "Platform tool execution succeeded",
      {
        toolKey: "code_run",
        language,
      },
    );

    return {
      widget: "code_result",
      success: true,
      language,
      result: result ?? null,
    };
  }

  private async webScrape(
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    const url = String(args.url ?? "").trim();

    if (!url) {
      throw new Error("web_scrape requires a url.");
    }

    const response = await this.fetchOrThrow(url);

    if (!response.ok) {
      throw new Error(`web_scrape failed with status ${response.status}.`);
    }

    const html = await response.text();
    const $ = load(html);
    const selectors =
      args.selectors && typeof args.selectors === "object" && !Array.isArray(args.selectors)
        ? (args.selectors as Record<string, string>)
        : null;

    const extracted = selectors
      ? Object.fromEntries(
          Object.entries(selectors).map(([key, selector]) => [
            key,
            $(selector)
              .map((_, element) => $(element).text().trim())
              .get()
              .filter(Boolean),
          ]),
        )
      : {
          title: $("title").first().text().trim() || null,
          text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000),
        };

    await this.firebaseViewLog.executionLog(
      context.agentId,
      context.sessionId,
      "Platform tool execution succeeded",
      {
        toolKey: "web_scrape",
        url,
      },
    );

    return {
      widget: "web_scrape",
      url,
      extracted,
    };
  }

  private async summarize(
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    const text = String(args.text ?? "").trim();
    const style = String(args.style ?? "narrative").trim().toLowerCase();
    const length = String(args.length ?? "medium").trim().toLowerCase();

    if (!text) {
      throw new Error("summarize requires text.");
    }

    const sentenceLimit =
      length === "short" ? 2 : length === "long" ? 6 : 4;
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, sentenceLimit);

    const summary =
      style === "bullet"
        ? sentences.map((sentence) => `- ${sentence}`).join("\n")
        : sentences.join(" ");

    await this.firebaseViewLog.executionLog(
      context.agentId,
      context.sessionId,
      "Platform tool execution succeeded",
      {
        toolKey: "summarize",
      },
    );

    return {
      widget: "summary",
      style,
      length,
      summary,
    };
  }

  private async analyzeSentiment(
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    const text = String(args.text ?? "").trim().toLowerCase();

    if (!text) {
      throw new Error("analyze_sentiment requires text.");
    }

    const positiveWords = ["good", "great", "excellent", "love", "happy", "amazing"];
    const negativeWords = ["bad", "terrible", "hate", "sad", "angry", "awful"];

    const positive = positiveWords.reduce(
      (count, word) => count + (text.includes(word) ? 1 : 0),
      0,
    );
    const negative = negativeWords.reduce(
      (count, word) => count + (text.includes(word) ? 1 : 0),
      0,
    );
    const score = positive - negative;

    await this.firebaseViewLog.executionLog(
      context.agentId,
      context.sessionId,
      "Platform tool execution succeeded",
      {
        toolKey: "analyze_sentiment",
      },
    );

    return {
      widget: "sentiment",
      label: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
      score,
      positive,
      negative,
    };
  }

  private async fileParse(
    args: Record<string, unknown>,
    context: PlatformToolExecutionContext,
  ): Promise<unknown> {
    const extract = String(args.extract ?? "").trim() || "text";
    const fileUrl = String(args.fileUrl ?? args.url ?? "").trim();
    const text = typeof args.text === "string" ? args.text : null;

    if (!fileUrl && !text) {
      throw new Error("file_parse requires text or fileUrl.");
    }

    let parsed: Record<string, unknown>;

    if (text) {
      parsed = {
        parser: "inline-text",
        extractedText: text,
      };
    } else {
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(`file_parse failed to fetch file with status ${response.status}.`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const url = new URL(fileUrl);
      const filename = url.pathname.split("/").filter(Boolean).pop() || "file.txt";
      parsed = (await this.fileParserService.parse({
        filename,
        mimeType: response.headers.get("content-type") ?? undefined,
        buffer: Buffer.from(arrayBuffer),
      })) as unknown as Record<string, unknown>;
    }

    await this.firebaseViewLog.executionLog(
      context.agentId,
      context.sessionId,
      "Platform tool execution succeeded",
      {
        toolKey: "file_parse",
        extract,
      },
    );

    return {
      widget: "file_parse",
      extract,
      ...parsed,
    };
  }
}

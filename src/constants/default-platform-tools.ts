import { PlatformToolArg } from "../entities/platform-tool.entity";

export type PlatformToolWidgetKind =
  | "search_results"
  | "fact_check"
  | "summary"
  | "sentiment"
  | "code_result"
  | "web_scrape"
  | "file_parse"
  | "generic";

export interface PlatformToolWidget {
  kind: PlatformToolWidgetKind;
  label: string;
  description?: string;
}

export interface DefaultPlatformTool {
  isNew: boolean;
  systemEnabled: boolean;
  userEnabled: boolean;
  key: string;
  name: string;
  description: string;
  example: string;
  args: PlatformToolArg[];
  sampleCall: string;
  implemented: boolean;
  widget: PlatformToolWidget;
}

export const defaultPlatformTools: Record<string, DefaultPlatformTool> = {
  web_search: {
    isNew: true,
    systemEnabled: true,
    userEnabled: true,
    key: "web_search",
    name: "Web Search",
    description:
      "Retrieves and summarizes real-time information from the internet.",
    example: "Finding the latest stock prices or news.",
    args: [
      { name: "query", type: "string", description: "Search query text." },
      {
        name: "max_results",
        type: "number",
        description: "Maximum number of search results to return.",
      },
    ],
    sampleCall: `return await PLATFORM.web_search({ query: args.query, max_results: args.max_results ?? 5 });`,
    implemented: true,
    widget: {
      kind: "search_results",
      label: "Search Results",
      description: "Renders search hits with source links and snippets.",
    },
  },
  fact_check: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "fact_check",
    name: "Fact Check",
    description: "Validates claims or statements using trusted data sources.",
    example: "Verifying medical or financial information before responding.",
    args: [{ name: "claim", type: "string", description: "Statement to verify." }],
    sampleCall: `return await PLATFORM.fact_check({ claim: args.claim });`,
    implemented: true,
    widget: {
      kind: "fact_check",
      label: "Fact Check",
      description: "Shows verdict, confidence, and evidence links.",
    },
  },
  code_run: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "code_run",
    name: "Code Execution",
    description: "Executes code snippets safely in an isolated runtime.",
    example: "Testing small algorithms, calculations, or script evaluations.",
    args: [
      {
        name: "language",
        type: "string",
        description: "Programming language.",
      },
      { name: "code", type: "string", description: "Code to execute." },
    ],
    sampleCall: `return await PLATFORM.code_run({ language: args.language ?? "javascript", code: args.code });`,
    implemented: true,
    widget: {
      kind: "code_result",
      label: "Code Result",
      description: "Displays execution language and returned output.",
    },
  },
  file_parse: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "file_parse",
    name: "File Parsing",
    description:
      "Reads and extracts information from uploaded documents or text files.",
    example: "Parsing PDFs, CSVs, or text reports.",
    args: [
      { name: "file", type: "File", description: "File to parse." },
      {
        name: "extract",
        type: "string",
        description: "Type of information to extract.",
      },
    ],
    sampleCall: `return await PLATFORM.file_parse({ fileUrl: args.fileUrl, extract: args.extract ?? "text" });`,
    implemented: true,
    widget: {
      kind: "file_parse",
      label: "File Parse",
      description: "Displays extracted text and parser metadata.",
    },
  },
  translate: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "translate",
    name: "Translation",
    description:
      "Translates text across multiple languages using an LLM-tuned translation layer.",
    example: "Responding to multilingual users seamlessly.",
    args: [
      { name: "text", type: "string", description: "Text to translate." },
      {
        name: "to",
        type: "string",
        description: "Target language for translation.",
      },
    ],
    sampleCall: `return await PLATFORM.translate({ text: args.text, to: args.to });`,
    implemented: false,
    widget: {
      kind: "generic",
      label: "Translation",
      description: "Reserved for translated text output.",
    },
  },
  summarize: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "summarize",
    name: "Summarization",
    description: "Generates concise summaries from long-form content.",
    example: "Summarizing articles, documents, or meeting notes.",
    args: [
      { name: "text", type: "string", description: "Text to summarize." },
      {
        name: "style",
        type: "string",
        description: "Summary style (e.g., bullet, narrative).",
      },
      {
        name: "length",
        type: "string",
        description: "Desired summary length (e.g., short, medium, long).",
      },
    ],
    sampleCall: `return await PLATFORM.summarize({ text: args.text, style: args.style ?? "narrative", length: args.length ?? "medium" });`,
    implemented: true,
    widget: {
      kind: "summary",
      label: "Summary",
      description: "Shows a readable summary block.",
    },
  },
  analyze_sentiment: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "analyze_sentiment",
    name: "Sentiment Analysis",
    description: "Detects emotional tone and intent in text.",
    example: "Understanding user mood or classifying feedback.",
    args: [{ name: "text", type: "string", description: "Text to analyze." }],
    sampleCall: `return await PLATFORM.analyze_sentiment({ text: args.text });`,
    implemented: true,
    widget: {
      kind: "sentiment",
      label: "Sentiment",
      description: "Displays label and scoring summary.",
    },
  },
  web_scrape: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "web_scrape",
    name: "Web Scraping",
    description: "Extracts structured information from live web pages.",
    example: "Gathering product details, reviews, or competitor data.",
    args: [
      { name: "url", type: "string", description: "Web page URL to scrape." },
      {
        name: "selectors",
        type: "Record<string, string>",
        description: "CSS selectors to extract specific elements.",
      },
    ],
    sampleCall: `return await PLATFORM.web_scrape({ url: args.url, selectors: args.selectors });`,
    implemented: true,
    widget: {
      kind: "web_scrape",
      label: "Scraped Content",
      description: "Renders extracted title and fields from a page.",
    },
  },
  generate_image: {
    isNew: true,
    systemEnabled: true,
    userEnabled: true,
    key: "generate_image",
    name: "Image Generation",
    description: "AI-powered image synthesis.",
    example: "Creating diagrams, product images, or marketing visuals.",
    args: [
      {
        name: "prompt",
        type: "string",
        description: "Text prompt for image generation.",
      },
      {
        name: "size",
        type: "string",
        description: "Desired image size (e.g., 512x512).",
      },
    ],
    sampleCall: `return await PLATFORM.generate_image({ prompt: args.prompt, size: args.size ?? "1024x1024" });`,
    implemented: false,
    widget: {
      kind: "generic",
      label: "Image Output",
      description: "Reserved for generated media previews.",
    },
  },
  speech_to_text: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "speech_to_text",
    name: "Speech to Text",
    description: "Voice input processing.",
    example: "Converting recorded audio to text commands or transcripts.",
    args: [{ name: "audio", type: "File", description: "Audio file to transcribe." }],
    sampleCall: `return await PLATFORM.speech_to_text({ fileUrl: args.fileUrl });`,
    implemented: false,
    widget: {
      kind: "generic",
      label: "Transcript",
      description: "Reserved for transcription output.",
    },
  },
  text_to_speech: {
    isNew: false,
    systemEnabled: true,
    userEnabled: true,
    key: "text_to_speech",
    name: "Text to Speech",
    description: "Conversational audio responses.",
    example: "Generating spoken replies or readouts.",
    args: [
      {
        name: "text",
        type: "string",
        description: "Text to convert to speech.",
      },
      {
        name: "voice",
        type: "string",
        description: "Voice profile for audio output.",
      },
    ],
    sampleCall: `return await PLATFORM.text_to_speech({ text: args.text, voice: args.voice ?? "alloy" });`,
    implemented: false,
    widget: {
      kind: "generic",
      label: "Audio Output",
      description: "Reserved for generated speech output.",
    },
  },
};

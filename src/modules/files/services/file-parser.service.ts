import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { Service } from "fragment-ts";
import type { ParsedFileContent } from "../contracts/file-ingestion.contract";

@Service()
export class FileParserService {
  async parse(input: {
    filename: string;
    mimeType?: string;
    buffer: Buffer;
  }): Promise<ParsedFileContent> {
    const extension = this.extensionOf(input.filename);
    const mimeType = (input.mimeType ?? "").toLowerCase();

    if (mimeType.startsWith("text/") || extension === "txt" || extension === "md") {
      return {
        extractedText: input.buffer.toString("utf-8"),
        parser: "text",
      };
    }

    if (mimeType === "application/pdf" || extension === "pdf") {
      const parser = new PDFParse({ data: input.buffer });

      try {
        const [textResult, infoResult] = await Promise.all([
          parser.getText(),
          parser.getInfo(),
        ]);

        return {
          extractedText: textResult.text?.trim() || undefined,
          parser: "pdf-parse",
          pages: infoResult.total,
        };
      } finally {
        await parser.destroy();
      }
    }

    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      extension === "docx"
    ) {
      const parsed = await mammoth.extractRawText({ buffer: input.buffer });
      return {
        extractedText: parsed.value?.trim() || undefined,
        parser: "mammoth",
      };
    }

    return {
      parser: "metadata-only",
    };
  }

  private extensionOf(filename: string): string {
    const parts = filename.toLowerCase().split(".");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  }
}

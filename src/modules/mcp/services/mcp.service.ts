import fs from "fs";
import path from "path";
import { Service } from "fragment-ts";

@Service()
export class McpService {
  private readonly root = path.join(process.cwd(), "resources", "mcp");
  private readonly baseUrl = `${process.env.API_BASE_URL ?? ""}/public/mcp`;

  listServers() {
    if (!fs.existsSync(this.root)) {
      return [];
    }

    return fs
      .readdirSync(this.root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        slug: entry.name,
        publicUrl: this.toPublicUrl(entry.name),
      }));
  }

  getServer(slug: string) {
    const directory = path.join(this.root, slug);

    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
      throw new Error(`MCP server ${slug} not found.`);
    }

    const files = fs.readdirSync(directory).sort();

    return {
      slug,
      publicUrl: this.toPublicUrl(slug),
      files: files.map((file) => ({
        name: file,
        publicUrl: this.toPublicUrl(`${slug}/${file}`),
      })),
    };
  }

  resolvePublicUrl(absolutePath: string) {
    const normalizedRoot = path.resolve(this.root);
    const normalizedPath = path.resolve(absolutePath);

    if (!normalizedPath.startsWith(normalizedRoot)) {
      throw new Error("Requested MCP path is outside the allowed root.");
    }

    const relativePath = path.relative(normalizedRoot, normalizedPath);
    return {
      publicUrl: this.toPublicUrl(relativePath),
      relativePath: relativePath.replace(/\\/g, "/"),
    };
  }

  private toPublicUrl(relativePath: string) {
    return `${this.baseUrl}/${relativePath.replace(/\\/g, "/")}`;
  }
}

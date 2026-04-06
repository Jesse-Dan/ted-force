import { FrgClient } from "fragment-ts";
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";

export class VersionNameGenerator {
  static async generate(config?: { prefix?: string }): Promise<string> {

    const { prefix } = config || {};
    const baseName = uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: "-",
      style: "lowerCase",
    });

    return prefix ? `${prefix}-${baseName}` : baseName;
  }
}

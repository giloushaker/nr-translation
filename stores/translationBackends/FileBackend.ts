import type { TranslationString } from "../translationStore";
import type { TranslationBackend } from "./index";

// File-based backend implementation
export class FileBackend implements TranslationBackend {
  constructor(private file: File) {}

  async fetchTranslations(systemId: string, languageCode: string): Promise<TranslationString[]> {
    const text = await this.file.text();

    try {
      // Try parsing as JSON first
      if (this.file.name.endsWith(".json")) {
        return this.parseJsonFile(text);
      } else if (this.file.name.endsWith(".po")) {
        return this.parsePoFile(text);
      } else if (this.file.name.endsWith(".csv")) {
        return this.parseCsvFile(text);
      } else {
        // Try to auto-detect format
        return this.parseJsonFile(text);
      }
    } catch (error: any) {
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  }

  private parseJsonFile(text: string): TranslationString[] {
    const data = JSON.parse(text);

    if (data.translations && Array.isArray(data.translations)) {
      // Full JSON format
      return data.translations;
    } else if (typeof data === "object") {
      // Key-value JSON format
      return Object.entries(data).map(([key, translation]) => ({
        id: "",
        key,
        original: key,
        translation: translation as string,
        translated: true,
        catalogue: "imported",
        modified: false,
      }));
    }

    throw new Error("Unrecognized JSON format");
  }

  private parsePoFile(text: string): TranslationString[] {
    const translations: TranslationString[] = [];
    const lines = text.split("\n");
    let currentEntry: any = {};

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("msgid ")) {
        if (currentEntry.msgid && currentEntry.msgstr) {
          translations.push({
            id: "",
            key: currentEntry.msgid,
            original: currentEntry.msgid,
            translation: currentEntry.msgstr,
            translated: !!currentEntry.msgstr,
            catalogue: "imported",
            modified: false,
          });
        }
        currentEntry = { msgid: trimmed.slice(7, -1) };
      } else if (trimmed.startsWith("msgstr ")) {
        currentEntry.msgstr = trimmed.slice(8, -1);
      }
    }

    // Add last entry
    if (currentEntry.msgid && currentEntry.msgstr) {
      translations.push({
        id: "",
        key: currentEntry.msgid,
        original: currentEntry.msgid,
        translation: currentEntry.msgstr,
        translated: !!currentEntry.msgstr,
        catalogue: "imported",
        modified: false,
      });
    }

    return translations;
  }

  private parseCsvFile(text: string): TranslationString[] {
    const lines = text.split("\n");
    const translations: TranslationString[] = [];

    // Skip header if present
    const startIndex = lines[0]?.includes("Original") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      const columns = this.parseCsvLine(line);
      if (columns.length >= 2) {
        translations.push({
          id: "",
          key: columns[0]!,
          original: columns[0]!,
          translation: columns[1]!,
          translated: !!columns[1],
          catalogue: columns[2] || "imported",
          modified: false,
        });
      }
    }

    return translations;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  async uploadTranslations(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
    throw new Error("File backend does not support uploading");
  }

  isAvailable(): boolean {
    return true;
  }

  async getStats(systemId: string): Promise<any> {
    // File backend doesn't have stats, return null
    return null;
  }
}

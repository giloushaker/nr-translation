import type { TranslationString, TranslationCatalogue } from "../translationStore";
import type { TranslationSource } from "./index";

// T9A translation source (to be implemented)
export class T9ATranslationSource implements TranslationSource {
  constructor(private systemId: string) {}

  getId(): string {
    return `t9a-${this.systemId}`;
  }

  getName(): string {
    return `${this.systemId} (The 9th Age)`;
  }

  async getTranslations(languageCode: string, progressCallback?: (progress: number, message?: string) => void): Promise<{
    strings: Record<string, Set<string>>;
    catalogues: TranslationCatalogue[];
    translations: TranslationString[];
  }> {
    // TO BE IMPLEMENTED
    throw new Error("T9A translation source not yet implemented");
  }
}
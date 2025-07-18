import type { TranslationString } from "../translationStore";
import type { TranslationBackend } from "./index";

// Default no-op backend implementation
export class NoOpBackend implements TranslationBackend {
  async getStats(systemId: string): Promise<any> {
    // Return null to indicate no stats available
    return null;
  }

  async fetchTranslations(systemId: string, languageCode: string): Promise<TranslationString[]> {
    return [];
  }

  async uploadTranslations(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
    // No-op
  }

  isAvailable(): boolean {
    return false;
  }
}
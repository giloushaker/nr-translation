import type { TranslationString } from "../translationStore";
import type { TranslationBackend } from "./index";

// Default no-op backend implementation
export class NoOpBackend implements TranslationBackend {
  getSystems(): Promise<Array<{ name: string; description: string; id: string; }>> {
    throw new Error("Method not implemented.");
  }
  
  getStats(systemId: string): Promise<any> {
    throw new Error("Method not implemented.");
  }
  
  async sync(systemId: string, languageCode: string): Promise<TranslationString[]> {
    return [];
  }

  async submit(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
    // No-op
  }

  isAvailable(): boolean {
    return false;
  }
}
import type { TranslationString } from "../translationStore";

// Backend interface for translation sync
export interface TranslationBackend {
  // Sync translations from backend to local
  sync(systemId: string, languageCode: string): Promise<TranslationString[]>;

  // Submit translations from local to backend
  submit(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void>;

  // Check if backend is available/configured
  isAvailable(): boolean;

  getSystems(): Promise<Array<{ name: string, description: string, id: string }>>;
  getStats(systemId: string): Promise<any>;
}

// Re-export all backends
export { NoOpBackend } from "./NoOpBackend";
export { FileBackend } from "./FileBackend";
export { HttpBackend } from "./HttpBackend";
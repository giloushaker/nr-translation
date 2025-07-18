import type { TranslationString } from "../translationStore";

// Backend interface for translation sync
export interface TranslationBackend {
  // Fetch translations from backend to local
  fetchTranslations(systemId: string, languageCode: string): Promise<TranslationString[]>;

  // Upload translations from local to backend
  uploadTranslations(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void>;

  // Check if backend is available/configured
  isAvailable(): boolean;

  getStats(systemId: string): Promise<any>;
}

// Re-export all backends
export { NoOpBackend } from "./NoOpBackend";
export { FileBackend } from "./FileBackend";
export { HttpBackend } from "./HttpBackend";
export { GithubBackend } from "./GithubBackend";
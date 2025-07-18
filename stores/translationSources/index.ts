import type { TranslationString, TranslationCatalogue } from "../translationStore";

// Translation source interface for extracting translatable strings from various sources
export interface TranslationSource {
  // Get unique identifier for this source
  getId(): string;

  // Get display name for this source
  getName(): string;

  // Get translations for a specific language
  getTranslations(languageCode: string, progressCallback?: (progress: number, message?: string) => void): Promise<{
    strings: Record<string, Set<string>>;
    catalogues: TranslationCatalogue[];
    translations: TranslationString[];
  }>;
}

// Re-export all sources
export { BSDataTranslationSource } from "./BSDataTranslationSource";
export { NewRecruitTranslationSource } from "./NewRecruitTranslationSource";
export { T9ATranslationSource } from "./T9ATranslationSource";
export { JSONTranslationSource } from "./JSONTranslationSource";

// Import for local use
import { BSDataTranslationSource } from "./BSDataTranslationSource";
import { NewRecruitTranslationSource } from "./NewRecruitTranslationSource";

// Factory function to create the appropriate translation source for any systemId
export function createTranslationSourceForSystem(systemId: string): TranslationSource {
  if (systemId === "newrecruit") {
    return new NewRecruitTranslationSource();
  }

  // For all other systems, assume they are BSData systems
  return new BSDataTranslationSource(systemId);
}

// Get just the system name without loading translations
export async function getSystemName(systemId: string): Promise<string> {
  const source = createTranslationSourceForSystem(systemId);
  return source.getName();
}
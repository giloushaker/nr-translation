import type { TranslationString, TranslationCatalogue } from "../translationStore";
import type { TranslationSource } from "./index";

// JSON-based translation source
export class JSONTranslationSource implements TranslationSource {
  constructor(private jsonData: any, private sourceId: string = "json") {}

  getId(): string {
    return this.sourceId;
  }

  getName(): string {
    return this.jsonData.name || "JSON Translation Source";
  }

  async getTranslations(languageCode: string, progressCallback?: (progress: number, message?: string) => void): Promise<{
    catalogues: TranslationCatalogue[];
    translations: TranslationString[];
  }> {
    const catalogueList: TranslationCatalogue[] = [];
    const allTranslations: TranslationString[] = [];

    // Extract translatable strings from JSON structure
    if (this.jsonData.translatable_strings) {
      const catalogueName = "main";
      const strings: TranslationString[] = [];

      this.jsonData.translatable_strings.forEach((str: string, index: number) => {
        const translationString: TranslationString = {
          id: `${catalogueName}-${index}`,
          key: str,
          original: str,
          translation: "",
          translated: false,
          catalogue: catalogueName,
        };

        strings.push(translationString);
        allTranslations.push(translationString);
      });

      catalogueList.push({
        id: catalogueName,
        name: catalogueName,
        stringCount: strings.length,
        strings: strings,
      });
    }

    return {
      catalogues: catalogueList,
      translations: allTranslations
    };
  }
}
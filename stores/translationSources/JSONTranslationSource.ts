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
    strings: Record<string, Set<string>>;
    catalogues: TranslationCatalogue[];
    translations: TranslationString[];
  }> {
    const rawStrings: Record<string, Set<string>> = {};
    const catalogueList: TranslationCatalogue[] = [];
    const allTranslations: TranslationString[] = [];

    // Extract translatable strings from JSON structure
    if (this.jsonData.translatable_strings) {
      const catalogueName = "main";
      const stringSet = new Set<string>();
      const strings: TranslationString[] = [];

      this.jsonData.translatable_strings.forEach((str: string, index: number) => {
        stringSet.add(str);
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

      rawStrings[catalogueName] = stringSet;
      catalogueList.push({
        id: catalogueName,
        name: catalogueName,
        stringCount: stringSet.size,
        strings: strings,
      });
    }

    return {
      strings: rawStrings,
      catalogues: catalogueList,
      translations: allTranslations
    };
  }
}
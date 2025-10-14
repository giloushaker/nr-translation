import type { TranslationString, TranslationCatalogue } from "../translationStore";
import type { TranslationSource } from "./index";

// NewRecruit translation source - doesn't involve any system
export class NewRecruitTranslationSource implements TranslationSource {
  constructor() { }

  getId(): string {
    return "newrecruit";
  }

  getName(): string {
    return "NewRecruit (Placeholder)";
  }

  async getTranslations(languageCode: string, progressCallback?: (progress: number, message?: string) => void): Promise<{
    catalogues: TranslationCatalogue[];
    translations: TranslationString[];
  }> {
    progressCallback?.(10, "Loading NewRecruit interface strings...");

    // Example: NewRecruit has its own translatable strings
    const newRecruitStrings = [
      "Welcome to NewRecruit",
      "Create your army",
      "Select unit",
      "Add weapon",
      "Remove model",
      "Save roster",
      "Load roster",
      "Export to PDF",
      "Settings",
      "Help",
      "About",
      "Points cost",
      "Unit options",
      "Special rules",
      "Army composition"
    ];

    progressCallback?.(50, "Processing interface strings...");

    const catalogueName = "interface";
    const strings: TranslationString[] = [];
    const allTranslations: TranslationString[] = [];

    newRecruitStrings.forEach((str, index) => {
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

    const catalogueList: TranslationCatalogue[] = [{
      id: catalogueName,
      name: "Interface Strings",
      stringCount: strings.length,
      strings: strings,
    }];

    progressCallback?.(100, "NewRecruit strings loaded");

    return {
      catalogues: catalogueList,
      translations: allTranslations
    };
  }
}
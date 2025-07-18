import type { TranslationString } from "../translationStore";
import type { TranslationBackend } from "./index";
import { GithubSubmission } from "../../utils/githubSubmission";

interface GithubTranslationFile {
  meta: {
    system: string;
    language: string;
    languageName: string;
    exportDate: string;
    totalStrings: number;
  };
  translations: Array<{
    key: string;
    original: string;
    translation: string;
    translated: boolean;
    catalogue: string;
  }>;
}

export class GithubBackend implements TranslationBackend {
  private readonly owner = "NewRecruitEU";
  private readonly repo = "translations";
  private readonly apiBase = "https://api.github.com";

  constructor() { }

  async fetchTranslations(systemId: string, languageCode: string): Promise<TranslationString[]> {
    try {
      // Fetch the translations.json file from the repo
      const path = `${systemId}/${languageCode}/translations.json`;
      const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`;

      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (response.status === 404) {
        // No translations exist yet for this language
        return [];
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch translations: ${response.status} ${response.statusText}`);
      }

      const fileData = await response.json();

      // Decode base64 content with proper UTF-8 handling
      const content = this.base64ToUtf8(fileData.content);
      const translationFile: GithubTranslationFile = JSON.parse(content);

      // Convert to TranslationString format
      return translationFile.translations.map(t => ({
        id: `${t.key}-${t.catalogue}`, // Generate ID from key and catalogue
        key: t.key,
        original: t.original,
        translation: t.translation,
        translated: t.translated,
        catalogue: t.catalogue,
        modified: false
      }));
    } catch (error) {
      console.error("Error fetching translations from GitHub:", error);
      throw error;
    }
  }

  async uploadTranslations(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
    try {
      // First, fetch existing translations to merge with
      const existingTranslations = await this.fetchTranslations(systemId, languageCode);

      // Create a map of existing translations by key
      const existingMap = new Map(existingTranslations.map(t => [t.key, t]));

      // Merge translations: new/modified translations override existing ones
      const mergedTranslations = new Map(existingMap);

      // Update with new/modified translations
      translations.forEach(t => {
        if (t.modified || t.translated) {
          mergedTranslations.set(t.key, t);
        }
      });

      // Convert back to array and sort by key for consistency
      const finalTranslations = Array.from(mergedTranslations.values())
        .sort((a, b) => a.key.localeCompare(b.key));

      const translationFile: GithubTranslationFile = {
        meta: {
          system: systemId,
          language: languageCode,
          languageName: languageCode,
          exportDate: new Date().toISOString(),
          totalStrings: finalTranslations.length
        },
        translations: finalTranslations.map(t => ({
          key: t.key,
          original: t.original,
          translation: t.translation,
          translated: t.translated,
          catalogue: t.catalogue
        }))
      };

      const fileContent = JSON.stringify(translationFile, null, 2);

      // Check if file exists
      const path = `${systemId}/${languageCode}/translations.json`;
      let fileExists = false;
      try {
        const checkUrl = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const checkResponse = await fetch(checkUrl, { headers: this.getHeaders() });
        fileExists = checkResponse.ok;
      } catch {
        fileExists = false;
      }

      if (fileExists) {
        // For existing files, we'll create an issue with the merged translations
        // since GitHub doesn't support pre-filling content when editing existing files
        const issueUrl = GithubSubmission.createIssueUrl(systemId, languageCode, finalTranslations);
        window.open(issueUrl, '_blank');
        
        alert('Since the translation file already exists, we\'ve opened a GitHub issue with your merged translations. A maintainer will review and create a PR with your changes.');
      } else {
        // For new files, use the direct edit URL
        const editUrl = GithubSubmission.createDirectEditUrl(systemId, languageCode, fileContent);
        window.open(editUrl, '_blank');
        
        alert('Opening GitHub to create a new translation file. GitHub will guide you through creating a PR.');
      }
    } catch (error) {
      console.error('Error preparing translations for upload:', error);
      throw new Error('Failed to prepare translations. Please try again.');
    }
  }

  isAvailable(): boolean {
    return true; // GitHub backend is always available for reading
  }

  async getStats(systemId: string): Promise<any> {
    try {
      // List all language folders for the system
      const path = systemId;
      const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`;

      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (response.status === 404) {
        return { languages: [] };
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
      }

      const contents = await response.json();

      // Filter for directories (language folders)
      const languageFolders = contents.filter((item: any) => item.type === "dir");

      const stats = {
        languages: [] as Array<{
          code: string;
          translatedCount: number;
          totalCount: number;
          lastUpdated: string;
        }>
      };

      // Fetch translation stats for each language
      for (const folder of languageFolders) {
        try {
          const translations = await this.fetchTranslations(systemId, folder.name);
          const translatedCount = translations.filter(t => t.translated).length;

          stats.languages.push({
            code: folder.name,
            translatedCount,
            totalCount: translations.length,
            lastUpdated: new Date().toISOString() // Could be enhanced with actual commit date
          });
        } catch (error) {
          // Skip languages that don't have valid translation files
          console.warn(`Failed to fetch stats for ${folder.name}:`, error);
        }
      }

      return stats;
    } catch (error) {
      console.error("Error fetching stats from GitHub:", error);
      return { languages: [] };
    }
  }

  // Helper methods
  private getHeaders(): HeadersInit {
    return {
      "Accept": "application/vnd.github.v3+json"
    };
  }

  private base64ToUtf8(base64: string): string {
    // Remove any whitespace from the base64 string
    const cleanBase64 = base64.replace(/\s/g, '');
    
    // Decode base64 to bytes
    const binaryString = atob(cleanBase64);
    
    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Decode UTF-8 bytes to string
    return new TextDecoder('utf-8').decode(bytes);
  }
}
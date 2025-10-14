import { defineStore } from "pinia";
import { useTranslationStore } from "./translationStore";

export interface SystemStats {
  systemId: string;
  totalStrings: number;
  languages: Record<string, LanguageStats>;
  lastUpdated: number;
}

export interface LanguageStats {
  code: string;
  name: string;
  total: number;
  translated: number;
  reviewed: number;
  untranslated: number;
  translatedPercent: number;
  reviewedPercent: number;
}

export const useStatsStore = defineStore("stats", {
  state: () => ({
    systemStats: {} as Record<string, SystemStats>,
    isLoading: false,
    lastError: null as string | null,
  }),

  getters: {
    getSystemStats:
      (state) =>
      (systemId: string): SystemStats | null => {
        return state.systemStats[systemId] || null;
      },

    getLanguageStats:
      (state) =>
      (systemId: string, languageCode: string): LanguageStats | null => {
        const systemStats = state.systemStats[systemId];
        return systemStats?.languages[languageCode] || null;
      },

    isStatsExpired:
      (state) =>
      (systemId: string, maxAge: number = 5 * 60 * 1000): boolean => {
        const stats = state.systemStats[systemId];
        if (!stats) return true;
        return Date.now() - stats.lastUpdated > maxAge;
      },
  },

  actions: {
    async loadStatsForSystem(systemId: string, forceRefresh = false): Promise<SystemStats> {
      // Check if we have cached data and it's not expired (unless force refresh)
      if (!forceRefresh && this.systemStats[systemId] && !this.isStatsExpired(systemId)) {
        return this.systemStats[systemId];
      }

      this.isLoading = true;
      this.lastError = null;

      try {
        const translationStore = useTranslationStore();

        // Default language list
        const defaultLanguages = [
          { code: "en", name: "English" },
          { code: "es", name: "Spanish" },
          { code: "fr", name: "French" },
          { code: "de", name: "German" },
          { code: "it", name: "Italian" },
          { code: "pt", name: "Portuguese" },
          { code: "ru", name: "Russian" },
          { code: "ja", name: "Japanese" },
          { code: "cn", name: "Chinese" },
        ];

        // Try to get backend stats first (for both total and per-language data)
        let backendStats: any = null;
        if (translationStore.backend?.isAvailable()) {
          try {
            backendStats = await translationStore.backend.getStats(systemId);
          } catch (error) {
            console.warn("Failed to load stats from backend:", error);
          }
        }

        // Get system total from source - simple and reliable
        let totalStrings = 0;

        try {
          const translationSources = await import("./translationSources");
          const source = translationSources.createTranslationSourceForSystem(systemId);
          const systemInfo = await source.getTranslations("en"); // Just to get structure
          totalStrings = systemInfo.translations.length;

          // Clear any loaded data to avoid contamination
          translationStore.clearCache();
        } catch (error) {
          console.warn("Failed to get total from source:", error);

          // Fallback to backend stats if source fails
          if (backendStats?.totalStrings) {
            totalStrings = backendStats.totalStrings;
          }
        }

        // Build language stats
        const languages: Record<string, LanguageStats> = {};

        for (const lang of defaultLanguages) {
          let translated = 0;
          let reviewed = 0;

          // Check if backend provided stats for this language
          if (backendStats?.languages?.[lang.code]) {
            const langStats = backendStats.languages[lang.code];
            // Don't override totalStrings - it should be consistent across all languages
            translated = langStats.translated || 0;
            reviewed = langStats.reviewed || 0;
          } else {
            // Calculate from local IndexedDB data
            const localStats = await this.calculateLocalStats(systemId, lang.code, totalStrings);
            translated = localStats.translated;
            reviewed = localStats.reviewed;

            // Only update total if we haven't gotten it yet and this language has data
            if (totalStrings === 0 && localStats.total > 0) {
              totalStrings = localStats.total;
            }
          }

          const untranslated = Math.max(0, totalStrings - translated);
          const translatedPercent = totalStrings > 0 ? Math.round((translated / totalStrings) * 100) : 0;
          const reviewedPercent = totalStrings > 0 ? Math.round((reviewed / totalStrings) * 100) : 0;

          languages[lang.code] = {
            code: lang.code,
            name: lang.name,
            total: totalStrings, // ✅ Same total for all languages
            translated, // ✅ Language-specific translated count
            reviewed,
            untranslated,
            translatedPercent,
            reviewedPercent,
          };
        }

        const systemStats: SystemStats = {
          systemId,
          totalStrings,
          languages,
          lastUpdated: Date.now(),
        };

        // Cache the stats
        this.systemStats[systemId] = systemStats;

        return systemStats;
      } catch (error) {
        console.error("Failed to load stats for system:", systemId, error);
        this.lastError = error instanceof Error ? error.message : "Unknown error";

        // Return empty stats on error
        const emptyStats: SystemStats = {
          systemId,
          totalStrings: 0,
          languages: {},
          lastUpdated: Date.now(),
        };

        return emptyStats;
      } finally {
        this.isLoading = false;
      }
    },

    async calculateLocalStats(
      systemId: string,
      languageCode: string,
      systemTotal: number
    ): Promise<{ total: number; translated: number; reviewed: number }> {
      try {
        const translationStore = useTranslationStore();

        // Get the correct source ID
        const translationSources = await import("./translationSources");
        const source = translationSources.createTranslationSourceForSystem(systemId);
        const sourceId = source.getId();

        // Query IndexedDB for saved translations for this specific language
        const systemLanguageKey = `${sourceId}-${languageCode}`;
        const db = await translationStore.dbOpen();
        const transaction = db.transaction(["translations"], "readonly");
        const store = transaction.objectStore("translations");
        const index = store.index("systemLanguage");

        const savedTranslations = await new Promise<any[]>((resolve, reject) => {
          const results: any[] = [];
          const request = index.openCursor(IDBKeyRange.only(systemLanguageKey));

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };

          request.onerror = () => reject(request.error);
        });

        return {
          total: systemTotal, // Use the system total that was passed in
          translated: savedTranslations.length,
          reviewed: 0, // We don't track reviewed status yet
        };
      } catch (error) {
        console.warn("Failed to calculate local stats:", error);
        return { total: systemTotal, translated: 0, reviewed: 0 };
      }
    },

    async getLanguagesForSystem(systemId: string, forceRefresh = false): Promise<LanguageStats[]> {
      const systemStats = await this.loadStatsForSystem(systemId, forceRefresh);
      return Object.values(systemStats.languages);
    },

    // Clear cached stats (useful when translations are updated)
    clearStatsCache(systemId?: string) {
      if (systemId) {
        delete this.systemStats[systemId];
      } else {
        this.systemStats = {};
      }
    },

    // Update stats after translation changes (for real-time updates)
    updateTranslationCount(systemId: string, languageCode: string, translatedCount: number) {
      const systemStats = this.systemStats[systemId];
      if (systemStats?.languages[languageCode]) {
        const langStats = systemStats.languages[languageCode];
        langStats.translated = translatedCount;
        langStats.untranslated = Math.max(0, langStats.total - translatedCount);
        langStats.translatedPercent = langStats.total > 0 ? Math.round((translatedCount / langStats.total) * 100) : 0;

        // Update timestamp to keep cache fresh
        systemStats.lastUpdated = Date.now();
      }
    },
  },
});

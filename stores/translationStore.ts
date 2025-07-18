import { defineStore } from "pinia";
import { TranslationBackend, NoOpBackend, FileBackend } from "./translationBackends";
import { type TranslationSource } from "./translationSources";

export interface TranslationString {
  id: string;
  key: string;
  original: string;
  translation: string;
  translated: boolean;
  catalogue: string;
  modified?: boolean;
}

export interface TranslationCatalogue {
  id: string;
  name: string;
  stringCount: number;
  strings: TranslationString[];
}

export type ExportFormat = "json" | "json-kv" | "csv" | "po";

export const useTranslationStore = defineStore("translation", {
  state: () => ({
    strings: {} as Record<string, Set<string>>,
    catalogues: [] as TranslationCatalogue[],
    translations: [] as TranslationString[],
    isLoaded: false,
    currentSystemId: null as string | null,
    totalStrings: 0,
    translatedCount: 0,
    backend: new NoOpBackend() as TranslationBackend,
    translationSource: null as TranslationSource | null,
    isSyncing: false,
    isSubmitting: false,
    lastSyncTime: null as number | null,
    lastSubmitTime: null as number | null,
  }),

  getters: {
    systemStringCount: (state) => state.totalStrings,

    systemName: (state) => state.translationSource?.getName() || "Unknown System",

    getCatalogueById: (state) => (catalogueId: string) => {
      return state.catalogues.find(cat => cat.id === catalogueId);
    },

    getTranslationByKey: (state) => (key: string) => {
      return state.translations.find(t => t.key === key);
    },

    getTranslationsByStatus: (state) => (translated: boolean) => {
      return state.translations.filter(t => t.translated === translated);
    },

    canSync: (state) => state.backend.isAvailable() && !state.isSyncing,

    canSubmit: (state) => state.backend.isAvailable() && !state.isSubmitting,
  },

  actions: {
    // IndexedDB helper methods
    getStorageKey(systemId: string, languageCode: string): string {
      return `${systemId}-${languageCode}`;
    },

    async dbOpen(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('nr-translations', 2);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Clear old store if it exists
          if (db.objectStoreNames.contains('translations')) {
            db.deleteObjectStore('translations');
          }

          // Create new store with composite key
          const store = db.createObjectStore('translations', { keyPath: 'compositeKey' });

          // Index for querying by system-language combination
          store.createIndex('systemLanguage', 'systemLanguage', { unique: false });
          store.createIndex('systemId', 'systemId', { unique: false });
        };
      });
    },

    async dbPutRecord(record: any): Promise<void> {
      const db = await this.dbOpen();
      const transaction = db.transaction(['translations'], 'readwrite');
      const store = transaction.objectStore('translations');

      return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async dbGetByIndex(indexName: string, value: string): Promise<any[]> {
      const db = await this.dbOpen();
      const transaction = db.transaction(['translations'], 'readonly');
      const store = transaction.objectStore('translations');
      const index = store.index(indexName);

      return new Promise((resolve, reject) => {
        const results: any[] = [];
        const request = index.openCursor(IDBKeyRange.only(value));

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
    },

    async dbDeleteByIndex(indexName: string, value: string): Promise<void> {
      const db = await this.dbOpen();
      const transaction = db.transaction(['translations'], 'readwrite');
      const store = transaction.objectStore('translations');
      const index = store.index(indexName);

      return new Promise((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.only(value));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    },

    async saveTranslationsToLocal(systemId: string, languageCode: string, translations?: TranslationString[]) {
      // Only save translated strings to reduce storage
      const translatedStrings = translations ?? this.translations.filter(t => t.translated);
      const systemLanguageKey = `${systemId}-${languageCode}`;

      try {
        // Clear existing translations for this system-language combination
        await this.dbDeleteByIndex('systemLanguage', systemLanguageKey);

        // Save each translation as individual record
        for (const translation of translatedStrings) {
          const record = {
            compositeKey: `${systemId}-${languageCode}-${translation.key}`,
            systemId,
            languageCode,
            systemLanguage: systemLanguageKey,
            key: translation.key,
            translation: translation.translation,
            catalogue: translation.catalogue,
            modified: translation.modified,
            lastSaved: Date.now()
          };

          await this.dbPutRecord(record);
        }
      } catch (error) {
        console.warn('Failed to save translations to IndexedDB:', error);
      }
    },

    async loadTranslationsFromLocal(systemId: string, languageCode: string): Promise<boolean> {
      const systemLanguageKey = `${systemId}-${languageCode}`;

      try {
        // Get all saved translations for this system-language
        const savedTranslations = await this.dbGetByIndex('systemLanguage', systemLanguageKey);

        if (savedTranslations.length === 0) {
          return false;
        }

        // Restore translations to current state - optimized with Map lookups
        const translationMap = new Map(this.translations.map(t => [t.key, t]));

        savedTranslations.forEach((savedTranslation) => {
          const current = translationMap.get(savedTranslation.key);
          if (current) {
            current.translation = savedTranslation.translation || "";
            current.translated = true;
            current.modified = savedTranslation.modified || false;
          }
        });

        // Update catalogues to match - optimized with Map lookup
        const keyMap = new Map(this.translations.map(t => [t.key, t]));

        this.catalogues.forEach(catalogue => {
          catalogue.strings.forEach(string => {
            const translation = keyMap.get(string.key);
            if (translation) {
              string.translation = translation.translation;
              string.translated = translation.translated;
              string.modified = translation.modified;
            }
          });
        });

        // Update counts
        this.translatedCount = this.translations.filter(s => s.translated).length;

        return true;
      } catch (error) {
        console.warn('Failed to load translations from IndexedDB:', error);
        return false;
      }
    },

    async clearLocalTranslations(systemId: string, languageCode: string) {
      const systemLanguageKey = `${systemId}-${languageCode}`;

      try {
        await this.dbDeleteByIndex('systemLanguage', systemLanguageKey);
      } catch (error) {
        console.warn('Failed to clear translations from IndexedDB:', error);
      }
    },

    async loadTranslationsFromSource(translationSource: TranslationSource, languageCode?: string, progressCallback?: (progress: number, message?: string) => void) {
      const sourceId = translationSource.getId();

      // Only load if not already loaded for this source
      if (this.isLoaded && this.currentSystemId === sourceId) {
        return;
      }

      try {
        this.translationSource = translationSource;
        this.currentSystemId = sourceId;

        // Get translations using the source
        const { strings: rawStrings, catalogues: catalogueList, translations: allTranslations } =
          await this.translationSource.getTranslations(languageCode || 'en', progressCallback);

        this.strings = rawStrings;
        globalThis.strings = rawStrings;
        this.catalogues = catalogueList;
        this.translations = allTranslations;
        globalThis.translations = allTranslations;
        this.totalStrings = allTranslations.length;
        this.translatedCount = allTranslations.filter(s => s.translated).length;
        this.isLoaded = true;

        // Store the translation source
        this.translationSource = translationSource;

        // Try to restore saved translations from IndexedDB
        if (languageCode) {
          await this.loadTranslationsFromLocal(sourceId, languageCode);
        }
      } catch (error) {
        console.error("Failed to load translations:", error);
        throw error;
      }
    },

    async ensureTranslationsLoaded(systemId: string, languageCode: string, progressCallback?: (progress: number, message?: string) => void): Promise<void> {
      // If translations are already loaded for this exact system, return
      if (this.isLoaded && this.currentSystemId === systemId) {
        return;
      }

      // Always clear cache when loading a different system
      this.clearCache();

      // Create the appropriate translation source for this systemId
      const { createTranslationSourceForSystem } = await import("./translationSources");
      const source = createTranslationSourceForSystem(systemId);

      // Load translations using the source
      await this.loadTranslationsFromSource(source, languageCode, progressCallback);
      this.currentSystemId = systemId;
    },

    updateTranslation(stringId: string, translation: string, systemId?: string, languageCode?: string) {
      const translationObj = this.translations.find(t => t.id === stringId);
      if (translationObj) {
        translationObj.translation = translation;
        translationObj.modified = true;
        translationObj.translated = translation.trim() !== "";

        // Update translated count
        this.translatedCount = this.translations.filter(s => s.translated).length;

        // Update the catalogue's string as well
        const catalogue = this.catalogues.find(cat => cat.id === translationObj.catalogue);
        if (catalogue) {
          const catString = catalogue.strings.find(s => s.id === stringId);
          if (catString) {
            catString.translation = translation;
            catString.modified = true;
            catString.translated = translationObj.translated;
          }
        }

        // Auto-save to IndexedDB if system and language are provided
        if (systemId && languageCode) {
          this.saveTranslationsToLocal(systemId, languageCode, [translationObj]);
        }
      }
    },

    clearCache() {
      this.strings = {};
      this.catalogues = [];
      this.translations = [];
      this.isLoaded = false;
      this.currentSystemId = null;
      this.translationSource = null;
      this.totalStrings = 0;
      this.translatedCount = 0;

      // Clear global variables as well
      globalThis.strings = {};
      globalThis.translations = [];
    },

    // Backend configuration
    setBackend(backend: TranslationBackend) {
      this.backend = backend;
    },

    getCurrentTranslationSource() {
      return this.translationSource;
    },

    // Sync translations from file
    async syncFromFile(file: File, systemId: string, languageCode: string, strategy: 'server-wins' | 'client-wins' | 'ask-user' = 'ask-user'): Promise<{ conflicts: Array<{ key: string, original: string, local: string, server: string }> }> {
      const fileBackend = new FileBackend(file);
      const backendTranslations = await fileBackend.sync(systemId, languageCode);

      return await this.syncTranslations(backendTranslations, systemId, languageCode, strategy);
    },

    // Sync translations from backend with conflict detection
    async syncFromBackend(systemId: string, languageCode: string, strategy: 'server-wins' | 'client-wins' | 'ask-user' = 'ask-user'): Promise<{ conflicts: Array<{ key: string, original: string, local: string, server: string }> }> {
      if (!this.backend.isAvailable()) {
        throw new Error('No backend configured');
      }

      const backendTranslations = await this.backend.sync(systemId, languageCode);

      return await this.syncTranslations(backendTranslations, systemId, languageCode, strategy);
    },

    // Core sync logic that handles conflicts and updates
    async syncTranslations(backendTranslations: TranslationString[], systemId: string, languageCode: string, strategy: 'server-wins' | 'client-wins' | 'ask-user' = 'ask-user'): Promise<{ conflicts: Array<{ key: string, original: string, local: string, server: string }> }> {
      if (this.isSyncing) {
        throw new Error('Sync already in progress');
      }

      this.isSyncing = true;

      try {
        if (backendTranslations.length === 0) {
          this.lastSyncTime = Date.now();
          return { conflicts: [] };
        }

        const translationMap = new Map(this.translations.map(t => [t.key, t]));
        const conflicts: Array<{ key: string, original: string, local: string, server: string }> = [];
        const safeUpdates: Array<{ local: TranslationString, server: TranslationString }> = [];

        // Detect conflicts and safe updates
        backendTranslations.forEach((serverTranslation) => {
          const local = translationMap.get(serverTranslation.key);

          if (!local) return;

          // Check for conflicts: both local and server have changes
          if (local.modified &&
            local.translation !== serverTranslation.translation &&
            local.translation.trim() !== '' &&
            serverTranslation.translation.trim() !== '') {
            conflicts.push({
              key: serverTranslation.key,
              original: local.original,
              local: local.translation,
              server: serverTranslation.translation
            });
          } else {
            // Safe to update
            safeUpdates.push({ local, server: serverTranslation });
          }
        });

        // Apply safe updates immediately
        safeUpdates.forEach(({ local, server }) => {
          local.translation = server.translation;
          local.translated = server.translated;
          local.modified = false;
        });

        // Handle conflicts based on strategy
        if (conflicts.length > 0) {
          if (strategy === 'server-wins') {
            conflicts.forEach(conflict => {
              const local = translationMap.get(conflict.key);
              if (local) {
                local.translation = conflict.server;
                local.translated = true;
                local.modified = false;
              }
            });
          } else if (strategy === 'client-wins') {
            // Keep local changes, do nothing
          } else if (strategy === 'ask-user') {
            // Return conflicts for user to resolve
            return { conflicts };
          }
        }

        // Update catalogues to match
        this.updateCataloguesFromTranslations();

        // Update counts
        this.translatedCount = this.translations.filter(s => s.translated).length;

        // Save to local storage
        await this.saveTranslationsToLocal(systemId, languageCode);

        this.lastSyncTime = Date.now();
        return { conflicts: strategy === 'ask-user' ? conflicts : [] };
      } finally {
        this.isSyncing = false;
      }
    },

    // Helper method to update catalogues from translations
    updateCataloguesFromTranslations() {
      const keyMap = new Map(this.translations.map(t => [t.key, t]));

      this.catalogues.forEach(catalogue => {
        catalogue.strings.forEach(string => {
          const translation = keyMap.get(string.key);
          if (translation) {
            string.translation = translation.translation;
            string.translated = translation.translated;
            string.modified = translation.modified;
          }
        });
      });
    },

    // Resolve conflicts with user choices
    resolveConflicts(conflicts: Array<{ key: string, choice: 'local' | 'server', server: string }>) {
      const translationMap = new Map(this.translations.map(t => [t.key, t]));

      conflicts.forEach(conflict => {
        const local = translationMap.get(conflict.key);
        if (local && conflict.choice === 'server') {
          local.translation = conflict.server;
          local.translated = true;
          local.modified = false;
        }
        // If choice is 'local', keep current local translation
      });

      this.updateCataloguesFromTranslations();
      this.translatedCount = this.translations.filter(s => s.translated).length;
    },

    // Submit translations to backend
    async submitToBackend(systemId: string, languageCode: string, onlyModified: boolean = true): Promise<void> {
      if (!this.backend.isAvailable()) {
        throw new Error('No backend configured');
      }

      if (this.isSubmitting) {
        throw new Error('Submit already in progress');
      }

      this.isSubmitting = true;

      try {
        // Get translations to submit
        let translationsToSubmit = this.translations.filter(t => t.translated && t.translation.trim() !== '');

        if (onlyModified) {
          translationsToSubmit = translationsToSubmit.filter(t => t.modified);
        }

        if (translationsToSubmit.length > 0) {
          await this.backend.submit(systemId, languageCode, translationsToSubmit);

          // Mark submitted translations as unmodified
          translationsToSubmit.forEach(t => {
            t.modified = false;
          });

          // Update catalogues to match
          const keyMap = new Map(this.translations.map(t => [t.key, t]));

          this.catalogues.forEach(catalogue => {
            catalogue.strings.forEach(string => {
              const translation = keyMap.get(string.key);
              if (translation) {
                string.modified = translation.modified;
              }
            });
          });

          // Save to local storage
          await this.saveTranslationsToLocal(systemId, languageCode);
        }

        this.lastSubmitTime = Date.now();
      } finally {
        this.isSubmitting = false;
      }
    },

    exportTranslations(format: ExportFormat, languageCode: string, languageName: string, systemName: string, onlyTranslated: boolean = false, onlyUntranslated: boolean = false): { content: string; filename: string; mimeType: string } {
      let dataToExport = this.translations;

      if (onlyTranslated) {
        dataToExport = this.translations.filter(t => t.translated);
      } else if (onlyUntranslated) {
        dataToExport = this.translations.filter(t => !t.translated);
      }

      let content = "";
      let filename = `${systemName}_${languageCode}_translations`;
      let mimeType = "";

      switch (format) {
        case "json":
          const jsonData = {
            meta: {
              system: systemName,
              language: languageCode,
              languageName: languageName,
              exportDate: new Date().toISOString(),
              totalStrings: dataToExport.length
            },
            translations: dataToExport.map(t => ({
              key: t.key,
              original: t.original,
              translation: t.translation || "",
              translated: t.translated,
              catalogue: t.catalogue
            }))
          };
          content = JSON.stringify(jsonData, null, 2);
          filename += ".json";
          mimeType = "application/json";
          break;

        case "json-kv":
          const kvData = dataToExport
            .filter((t) => t.translated && t.original !== t.translation)
            .reduce((acc, t) => {
              acc[t.key] = t.translation;
              return acc;
            }, {} as Record<string, string>);
          content = JSON.stringify(kvData, null, 2);
          filename += "_kv.json";
          mimeType = "application/json";
          break;

        case "csv":
          // CSV header
          content = "Original,Translation,Catalogue,Status\n";
          dataToExport.forEach(t => {
            const original = t.original.replace(/"/g, '""');
            const translation = (t.translation || "").replace(/"/g, '""');
            const status = t.translated ? "translated" : "untranslated";
            content += `"${original}","${translation}","${t.catalogue}","${status}"\n`;
          });
          filename += ".csv";
          mimeType = "text/csv";
          break;

        case "po":
          // PO file header
          content = `# Translations for ${systemName}\n`;
          content += `# Language: ${languageName}\n`;
          content += `msgid ""\n`;
          content += `msgstr ""\n`;
          content += `"Content-Type: text/plain; charset=UTF-8\\n"\n`;
          content += `"Language: ${languageCode}\\n"\n\n`;

          dataToExport.forEach(t => {
            content += `#: ${t.catalogue}\n`;
            content += `msgid "${t.original.replace(/"/g, '\\"')}"\n`;
            content += `msgstr "${(t.translation || "").replace(/"/g, '\\"')}"\n\n`;
          });
          filename += ".po";
          mimeType = "text/plain";
          break;
      }

      return { content, filename, mimeType };
    },

    downloadExport(format: ExportFormat, languageCode: string, languageName: string, systemName: string, onlyTranslated: boolean = false, onlyUntranslated: boolean = false) {
      const { content, filename, mimeType } = this.exportTranslations(format, languageCode, languageName, systemName, onlyTranslated, onlyUntranslated);

      // Create and download the file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }
});
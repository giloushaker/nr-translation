import { defineStore } from "pinia";
import { toRaw } from "vue";
import { TranslationBackend, FileBackend } from "./translationBackends";
import { type TranslationSource } from "./translationSources";

export type TranslationStringType =
  | "unit"        // Unit entry (isUnit() === true)
  | "option"      // Other entries (not units)
  | "profileName" // Name of a profile
  | "profile"     // Profile field/stat
  | "ruleName"    // Name of a rule
  | "rule"        // Rule content
  | "category"    // Category name
  | "faction"     // Faction name
  | "other";      // Other strings

export interface TranslationString {
  id: string;
  key: string;
  original: string;
  translation: string;
  translated: boolean;
  catalogue: string;
  type?: TranslationStringType;
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
    catalogues: [] as TranslationCatalogue[],
    translations: [] as TranslationString[],
    isLoaded: false,
    currentSystemId: null as string | null,
    totalStrings: 0,
    translatedCount: 0,
    backend: null as TranslationBackend | null,
    translationSource: null as TranslationSource | null,
    isSyncing: false,
    isSubmitting: false,
    lastSyncTime: null as number | null,
    lastSubmitTime: null as number | null,
    lastUploadCount: 0,
  }),

  getters: {
    systemStringCount: (state) => state.totalStrings,

    systemName: (state) => state.translationSource?.getName() || "Unknown System",

    getCatalogueById: (state) => (catalogueId: string) => {
      return state.catalogues.find((cat) => cat.id === catalogueId);
    },

    getTranslationByKey: (state) => (key: string) => {
      return state.translations.find((t) => t.key === key);
    },

    getTranslationsByStatus: (state) => (translated: boolean) => {
      return state.translations.filter((t) => t.translated === translated);
    },

    canSync: (state) => state.backend?.isAvailable() && !state.isSyncing,

    canSubmit: (state) => state.backend?.isAvailable() && !state.isSubmitting,
  },

  actions: {
    // IndexedDB helper methods
    getStorageKey(systemId: string, languageCode: string): string {
      return `${systemId}-${languageCode}`;
    },

    async dbOpen(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("nr-translations", 2);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Clear old store if it exists
          if (db.objectStoreNames.contains("translations")) {
            db.deleteObjectStore("translations");
          }

          // Create new store with composite key
          const store = db.createObjectStore("translations", { keyPath: "compositeKey" });

          // Index for querying by system-language combination
          store.createIndex("systemLanguage", "systemLanguage", { unique: false });
          store.createIndex("systemId", "systemId", { unique: false });
        };
      });
    },

    async dbPutRecord(record: any): Promise<void> {
      const db = await this.dbOpen();
      const transaction = db.transaction(["translations"], "readwrite");
      const store = transaction.objectStore("translations");

      return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async dbGetByIndex(indexName: string, value: string): Promise<any[]> {
      const db = await this.dbOpen();
      const transaction = db.transaction(["translations"], "readonly");
      const store = transaction.objectStore("translations");
      const index = store.index(indexName);

      return new Promise((resolve, reject) => {
        // Use getAll() instead of cursor for much better performance
        const request = index.getAll(IDBKeyRange.only(value));

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => reject(request.error);
      });
    },

    async dbDeleteByIndex(indexName: string, value: string): Promise<void> {
      const db = await this.dbOpen();
      const transaction = db.transaction(["translations"], "readwrite");
      const store = transaction.objectStore("translations");
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

    async dbDeleteByCompositeKey(compositeKey: string): Promise<void> {
      const db = await this.dbOpen();
      const transaction = db.transaction(["translations"], "readwrite");
      const store = transaction.objectStore("translations");

      return new Promise((resolve, reject) => {
        const request = store.delete(compositeKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async saveTranslationsToLocal(systemId: string, languageCode: string, translations?: TranslationString[]) {
      const systemLanguageKey = `${systemId}-${languageCode}`;
      console.log("💾 Saving to IndexedDB:", { systemId, languageCode, translationsCount: translations?.length });

      try {
        if (translations && translations.length > 0) {
          // Save specific translations (for individual updates)
          for (const translation of translations) {
            // Only save if translated
            if (translation.translated) {
              const record = {
                compositeKey: `${systemId}-${languageCode}-${translation.key}`,
                systemId,
                languageCode,
                systemLanguage: systemLanguageKey,
                key: translation.key,
                translation: translation.translation,
                catalogue: translation.catalogue,
                modified: translation.modified,
                lastSaved: Date.now(),
              };

              console.log("💾 Saving translation:", { key: translation.key, translation: translation.translation });
              await this.dbPutRecord(record);
            } else {
              // If not translated, remove the record if it exists
              console.log("🗑️ Removing translation:", { key: translation.key });
              await this.dbDeleteByCompositeKey(`${systemId}-${languageCode}-${translation.key}`);
            }
          }
        } else {
          // Full save - clear and save all translated strings
          await this.dbDeleteByIndex("systemLanguage", systemLanguageKey);

          const translatedStrings = this.translations.filter((t) => t.translated);
          console.log("💾 Full save - translated strings:", translatedStrings.length);
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
              lastSaved: Date.now(),
            };

            await this.dbPutRecord(record);
          }
        }
        console.log("✅ Successfully saved to IndexedDB");
      } catch (error) {
        console.error("❌ Failed to save translations to IndexedDB:", error);
      }
    },

    async loadTranslationsFromLocal(systemId: string, languageCode: string): Promise<boolean> {
      const systemLanguageKey = `${systemId}-${languageCode}`;
      console.log("📖 Loading from IndexedDB:", { systemId, languageCode, systemLanguageKey });

      try {
        const startTime = performance.now();

        // Get all saved translations for this system-language
        const savedTranslations = await this.dbGetByIndex("systemLanguage", systemLanguageKey);
        console.log(`📖 Found ${savedTranslations.length} saved translations (${Math.round(performance.now() - startTime)}ms)`);

        if (savedTranslations.length === 0) {
          console.log("📖 No saved translations found");
          return false;
        }

        const mapStartTime = performance.now();
        // Build index map of translations by key OUTSIDE reactive context
        // Use array of indices to handle duplicate keys across catalogues
        const translationsByKey = new Map<string, number[]>();
        const translationsLength = this.translations.length;
        for (let i = 0; i < translationsLength; i++) {
          const key = this.translations[i].key;
          if (!translationsByKey.has(key)) {
            translationsByKey.set(key, []);
          }
          translationsByKey.get(key)!.push(i);
        }
        console.log(`📖 Built translation index: ${translationsLength} items (${Math.round(performance.now() - mapStartTime)}ms)`);

        const restoreStartTime = performance.now();

        // Prepare updates array - process all occurrences of each saved translation
        const updates: Array<{ index: number; translation: string; modified: boolean }> = [];
        const savedLength = savedTranslations.length;
        for (let i = 0; i < savedLength; i++) {
          const saved = savedTranslations[i];
          const indices = translationsByKey.get(saved.key);
          if (indices) {
            // Update ALL occurrences of this key (handles duplicates across catalogues)
            for (const idx of indices) {
              updates.push({
                index: idx,
                translation: saved.translation || "",
                modified: saved.modified || false,
              });
            }
          }
        }

        // Apply all updates by directly modifying the array without going through reactive proxy
        const patchStartTime = performance.now();
        console.log(`⏱️ Starting updates with ${updates.length} items...`);

        // Access the raw (non-reactive) array for faster modifications
        const rawTranslations = toRaw(this.translations);

        const updateLength = updates.length;
        for (let i = 0; i < updateLength; i++) {
          const update = updates[i];
          const trans = rawTranslations[update.index];
          if (trans) {
            trans.translation = update.translation;
            trans.translated = true;
            trans.modified = update.modified;
          }
        }

        // Update count
        this.translatedCount = updateLength;

        const patchEndTime = performance.now();
        console.log(`⏱️ Updates completed in ${Math.round(patchEndTime - patchStartTime)}ms`);

        console.log(`📖 Restored ${updates.length} translations (${Math.round(performance.now() - restoreStartTime)}ms)`);

        console.log(`✅ Successfully loaded from IndexedDB (total: ${Math.round(performance.now() - startTime)}ms)`);
        return true;
      } catch (error) {
        console.error("❌ Failed to load translations from IndexedDB:", error);
        return false;
      }
    },

    async clearLocalTranslations(systemId: string, languageCode: string) {
      const systemLanguageKey = `${systemId}-${languageCode}`;

      try {
        await this.dbDeleteByIndex("systemLanguage", systemLanguageKey);
      } catch (error) {
        console.warn("Failed to clear translations from IndexedDB:", error);
      }
    },

    async loadTranslationsFromSource(
      translationSource: TranslationSource,
      languageCode?: string,
      progressCallback?: (progress: number, message?: string) => void
    ) {
      const sourceId = translationSource.getId();
      console.log("🔄 loadTranslationsFromSource started:", { sourceId, languageCode });

      // Only load if not already loaded for this source
      if (this.isLoaded && this.currentSystemId === sourceId) {
        console.log("🔄 Already loaded for this source, skipping");
        return;
      }

      try {
        console.log("🔄 Setting translation source and ID");
        this.translationSource = translationSource;
        this.currentSystemId = sourceId;

        console.log("🔄 Getting translations from source...");
        // Get translations using the source
        const {
          catalogues: catalogueList,
          translations: allTranslations,
        } = await this.translationSource.getTranslations(languageCode || "en", progressCallback);

        console.log("🔄 Received translations:", {
          cataloguesCount: catalogueList.length,
          translationsCount: allTranslations.length
        });

        console.log("🔄 Storing translations in state...");
        this.catalogues = catalogueList;
        this.translations = allTranslations;
        globalThis.translations = allTranslations;
        this.totalStrings = allTranslations.length;
        this.translatedCount = allTranslations.filter((s) => s.translated).length;
        this.isLoaded = true;

        console.log("🔄 Setting translation source again...");
        // Store the translation source
        this.translationSource = translationSource;

        console.log("🔄 Loading from IndexedDB...");
        // Try to restore saved translations from IndexedDB
        if (languageCode) {
          await this.loadTranslationsFromLocal(sourceId, languageCode);
        }
        
        console.log("✅ loadTranslationsFromSource completed successfully");
      } catch (error) {
        console.error("❌ Failed to load translations:", error);
        throw error;
      }
    },

    async ensureTranslationsLoaded(
      systemId: string,
      languageCode: string,
      progressCallback?: (progress: number, message?: string) => void
    ): Promise<void> {
      // Create the appropriate translation source for this systemId to get the correct sourceId
      const { createTranslationSourceForSystem } = await import("./translationSources");
      const source = createTranslationSourceForSystem(systemId);
      const sourceId = source.getId();

      console.log("🚀 ensureTranslationsLoaded called:", {
        systemId,
        sourceId,
        languageCode,
        isLoaded: this.isLoaded,
        currentSystemId: this.currentSystemId,
      });

      // If translations are already loaded for this exact system, try to restore from IndexedDB and return
      if (this.isLoaded && this.currentSystemId === sourceId) {
        console.log("🚀 System already loaded, restoring from IndexedDB");
        // Always try to load from IndexedDB to restore any saved translations
        await this.loadTranslationsFromLocal(sourceId, languageCode);
        return;
      }

      console.log("🚀 Loading fresh data for system");
      // Always clear cache when loading a different system
      this.clearCache();

      // Load translations using the source
      await this.loadTranslationsFromSource(source, languageCode, progressCallback);
      this.currentSystemId = sourceId;
    },

    updateTranslation(stringId: string, translation: string, systemId?: string, languageCode?: string) {
      console.log("updating");
      const translationObj = this.translations.find((t) => t.id === stringId);
      if (translationObj) {
        translationObj.translation = translation;
        translationObj.modified = true;
        translationObj.translated = translation.trim() !== "";

        // Update translated count
        this.translatedCount = this.translations.filter((s) => s.translated).length;

        // Update the catalogue's string as well
        const catalogue = this.catalogues.find((cat) => cat.id === translationObj.catalogue);
        if (catalogue) {
          const catString = catalogue.strings.find((s) => s.id === stringId);
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
      this.catalogues = [];
      this.translations = [];
      this.isLoaded = false;
      this.currentSystemId = null;
      this.translationSource = null;
      this.totalStrings = 0;
      this.translatedCount = 0;

      // Clear global variables as well
      globalThis.translations = [];
    },

    // Backend configuration
    setBackend(backend: TranslationBackend) {
      this.backend = backend;
    },

    getCurrentTranslationSource() {
      return this.translationSource;
    },

    // Get last upload count for sync summary
    getLastUploadCount(): number {
      return this.lastUploadCount;
    },

    // Sync translations from file
    async syncFromFile(
      file: File,
      systemId: string,
      languageCode: string,
      strategy: "server-wins" | "client-wins" | "ask-user" = "ask-user"
    ): Promise<{ conflicts: Array<{ key: string; original: string; local: string; server: string }> }> {
      const fileBackend = new FileBackend(file);
      const backendTranslations = await fileBackend.fetchTranslations(systemId, languageCode);

      return await this.syncTranslations(backendTranslations, systemId, languageCode, strategy);
    },

    // Sync translations from backend with conflict detection
    async syncFromBackend(
      systemId: string,
      languageCode: string,
      strategy: "server-wins" | "client-wins" | "ask-user" = "ask-user"
    ): Promise<{ 
      conflicts: Array<{ key: string; original: string; local: string; server: string }>;
      received: number;
      uploaded: number; 
      resolvedConflicts: number;
      serverTranslations?: TranslationString[];
    }> {
      if (!this.backend?.isAvailable()) {
        throw new Error("No backend configured");
      }

      const backendTranslations = await this.backend.fetchTranslations(systemId, languageCode);

      return await this.syncTranslations(backendTranslations, systemId, languageCode, strategy);
    },

    // Core sync logic that handles conflicts and updates
    async syncTranslations(
      backendTranslations: TranslationString[],
      systemId: string,
      languageCode: string,
      strategy: "server-wins" | "client-wins" | "ask-user" = "ask-user"
    ): Promise<{ 
      conflicts: Array<{ key: string; original: string; local: string; server: string }>;
      received: number;
      uploaded: number;
      resolvedConflicts: number;
      serverTranslations?: TranslationString[];
    }> {
      if (this.isSyncing) {
        throw new Error("Sync already in progress");
      }

      this.isSyncing = true;

      try {
        let conflicts: Array<{ key: string; original: string; local: string; server: string }> = [];
        const received = backendTranslations.length;
        let resolvedConflicts = 0;

        if (backendTranslations.length === 0) {
          console.log("📝 Server has no translations, but will still upload local ones");
          console.log("🔍 Step 1: Skipping conflict detection - no server data");
          // Skip conflict detection entirely - no server data to conflict with
        } else {
          console.log("🔄 Processing", backendTranslations.length, "server translations for conflicts");
          const translationMap = new Map(this.translations.map((t) => [t.key, t]));
          const safeUpdates: Array<{ local: TranslationString; server: TranslationString }> = [];

          // Detect conflicts and safe updates
          backendTranslations.forEach((serverTranslation) => {
            const local = translationMap.get(serverTranslation.key);

            if (!local) return;

            // Check for conflicts: both local and server have changes
            if (
              local.modified &&
              local.translation !== serverTranslation.translation &&
              local.translation.trim() !== "" &&
              serverTranslation.translation.trim() !== ""
            ) {
              conflicts.push({
                key: serverTranslation.key,
                original: local.original,
                local: local.translation,
                server: serverTranslation.translation,
              });
            } else if (local.translation !== serverTranslation.translation) {
              // Only update if values are actually different
              safeUpdates.push({ local, server: serverTranslation });
            }
            // If translations are identical, do nothing - no update needed
          });

          // Apply safe updates immediately
          safeUpdates.forEach(({ local, server }) => {
            local.translation = server.translation;
            local.translated = server.translated;
            local.modified = false;
          });

          // Handle conflicts based on strategy
          if (conflicts.length > 0) {
            if (strategy === "server-wins") {
              conflicts.forEach((conflict) => {
                const local = translationMap.get(conflict.key);
                if (local) {
                  local.translation = conflict.server;
                  local.translated = true;
                  local.modified = false;
                  resolvedConflicts++;
                }
              });
            } else if (strategy === "client-wins") {
              // Keep local changes, do nothing
              resolvedConflicts = conflicts.length;
            } else if (strategy === "ask-user") {
              // Return conflicts for user to resolve, including server translations for proper upload logic
              return { 
                conflicts, 
                received, 
                uploaded: 0, 
                resolvedConflicts: 0,
                serverTranslations: backendTranslations
              };
            }
          }
        }

        // Update catalogues to match (skip if might cause freeze)
        console.log("🔍 Step 2: About to update catalogues...");
        // Note: This was causing freezes before with large datasets, so we're skipping it during sync
        // this.updateCataloguesFromTranslations();
        console.log("✅ Step 2: Skipping catalogue update to prevent freeze");

        // Update counts (skip to prevent freeze)
        console.log("🔍 Step 3: About to update translated count...");
        console.log("🔍 Step 3: Total translations to filter:", this.translations.length);
        // Skip this filtering operation as it might freeze with large datasets
        console.log("⚠️ Step 3: Skipping translated count update to prevent freeze");
        // this.translatedCount = this.translations.filter((s) => s.translated).length;
        console.log("✅ Step 3: Skipped translated count update");

        // Save to local storage
        console.log("🔍 Step 4: About to save to local storage...");
        await this.saveTranslationsToLocal(systemId, languageCode);
        console.log("✅ Step 4: Saved to local storage");

        // Upload local translations back to server (bidirectional sync)
        console.log("🔍 Step 5: About to upload local translations to server...");
        const serverTranslationKeys = new Set(backendTranslations.map(t => t.key));
        await this.uploadLocalTranslationsToServer(systemId, languageCode, serverTranslationKeys);
        console.log("✅ Step 5: Finished uploading local translations to server");

        console.log("🔍 Step 6: Finalizing sync...");
        console.log("🔍 Backend still available?", this.backend?.isAvailable());
        console.log("🔍 Backend URL:", this.backend ? "exists" : "missing");
        
        // Get uploaded count from the upload method
        const uploaded = this.getLastUploadCount();
        
        this.lastSyncTime = Date.now();
        console.log("✅ Sync completed successfully");
        
        return { 
          conflicts: strategy === "ask-user" ? conflicts : [],
          received,
          uploaded,
          resolvedConflicts
        };
      } finally {
        this.isSyncing = false;
      }
    },

    // Helper method to update catalogues from translations
    updateCataloguesFromTranslations() {
      const keyMap = new Map(this.translations.map((t) => [t.key, t]));

      this.catalogues.forEach((catalogue) => {
        catalogue.strings.forEach((string) => {
          const translation = keyMap.get(string.key);
          if (translation) {
            string.translation = translation.translation;
            string.translated = translation.translated;
            string.modified = translation.modified;
          }
        });
      });
    },

    // Upload local translations to server during sync (bidirectional sync)
    async uploadLocalTranslationsToServer(systemId: string, languageCode: string, serverTranslationKeys?: Set<string>): Promise<void> {
      if (!this.backend?.isAvailable()) {
        console.warn("No backend available for uploading local translations");
        return;
      }

      try {
        console.log("🔍 Debug: Total translations in store:", this.translations.length);
        console.log("🔍 Debug: Sample translations:", this.translations.slice(0, 3).map(t => ({
          id: t.id,
          key: t.key,
          translated: t.translated,
          translation: t.translation?.substring(0, 50) + "...",
          modified: t.modified
        })));

        // Get all local translations that should be uploaded
        // Only upload translations that are:
        // 1. Modified locally (have local changes)
        // 2. Don't exist on server (are new local translations)
        const translatedStrings = this.translations.filter((t) => t.translated && t.translation && t.translation.trim() !== "");
        
        const localTranslations = translatedStrings.filter((t) => {
          // Upload if it's a local modification
          if (t.modified) {
            return true;
          }
          
          // Upload if it doesn't exist on server (new local translation)
          if (serverTranslationKeys && !serverTranslationKeys.has(t.key)) {
            return true;
          }
          
          // Don't upload if it came from server and hasn't been modified
          return false;
        });
        
        console.log("🔍 Debug: Translated strings:", translatedStrings.length);
        console.log("🔍 Debug: Local translations to upload:", localTranslations.length);
        console.log("🔍 Debug: Server translation keys count:", serverTranslationKeys?.size || 0);

        if (localTranslations.length > 0) {
          console.log(`🔄 Uploading ${localTranslations.length} local translations to server during sync...`);
          console.log("🔍 Debug: Sample translations to upload:", localTranslations.slice(0, 2).map(t => ({
            id: t.id,
            key: t.key,
            translation: t.translation?.substring(0, 50) + "...",
          })));
          
          await this.backend.uploadTranslations(systemId, languageCode, localTranslations);
          console.log("✅ Local translations uploaded to server successfully");

          // Store uploaded count for sync summary
          this.lastUploadCount = localTranslations.length;

          // Mark uploaded translations as unmodified since they're now synced
          localTranslations.forEach((t) => {
            t.modified = false;
          });

          // Update catalogues to reflect the unmodified state (skip to prevent freeze)
          console.log("⚠️ Skipping catalogue update in upload to prevent freeze");
          // this.updateCataloguesFromTranslations();
          console.log("✅ Upload method completed successfully");
        } else {
          console.log("📝 No local translations to upload during sync");
          this.lastUploadCount = 0;
        }
      } catch (error) {
        console.error("❌ Failed to upload local translations to server:", error);
        this.lastUploadCount = 0;
        // Don't throw - sync should continue even if upload fails
      }
    },

    // Resolve conflicts with user choices
    resolveConflicts(conflicts: Array<{ key: string; choice: "local" | "server"; server: string }>) {
      const translationMap = new Map(this.translations.map((t) => [t.key, t]));

      conflicts.forEach((conflict) => {
        const local = translationMap.get(conflict.key);
        if (local && conflict.choice === "server") {
          local.translation = conflict.server;
          local.translated = true;
          local.modified = false;
        }
        // If choice is 'local', keep current local translation
      });

      // Skip expensive operations to prevent freezing with large datasets
      console.log("⚠️ Skipping catalogue update and count recalculation in resolveConflicts to prevent freeze");
      // this.updateCataloguesFromTranslations();
      // this.translatedCount = this.translations.filter((s) => s.translated).length;
    },

    // Submit translations to backend
    async submitToBackend(systemId: string, languageCode: string, onlyModified: boolean = true): Promise<void> {
      if (!this.backend?.isAvailable()) {
        throw new Error("No backend configured");
      }

      if (this.isSubmitting) {
        throw new Error("Submit already in progress");
      }

      this.isSubmitting = true;

      try {
        // Get translations to submit
        let translationsToSubmit = this.translations.filter((t) => t.translated && t.translation.trim() !== "");

        if (onlyModified) {
          translationsToSubmit = translationsToSubmit.filter((t) => t.modified);
        }

        if (translationsToSubmit.length > 0) {
          await this.backend.uploadTranslations(systemId, languageCode, translationsToSubmit);

          // Mark submitted translations as unmodified
          translationsToSubmit.forEach((t) => {
            t.modified = false;
          });

          // Update catalogues to match
          const keyMap = new Map(this.translations.map((t) => [t.key, t]));

          this.catalogues.forEach((catalogue) => {
            catalogue.strings.forEach((string) => {
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

    exportTranslations(
      format: ExportFormat,
      languageCode: string,
      languageName: string,
      systemName: string,
      onlyTranslated: boolean = false,
      onlyUntranslated: boolean = false
    ): { content: string; filename: string; mimeType: string } {
      let dataToExport = this.translations;

      if (onlyTranslated) {
        dataToExport = this.translations.filter((t) => t.translated);
      } else if (onlyUntranslated) {
        dataToExport = this.translations.filter((t) => !t.translated);
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
              totalStrings: dataToExport.length,
            },
            translations: dataToExport.map((t) => ({
              key: t.key,
              original: t.original,
              translation: t.translation || "",
              translated: t.translated,
              catalogue: t.catalogue,
            })),
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
          dataToExport.forEach((t) => {
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

          dataToExport.forEach((t) => {
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

    downloadExport(
      format: ExportFormat,
      languageCode: string,
      languageName: string,
      systemName: string,
      onlyTranslated: boolean = false,
      onlyUntranslated: boolean = false
    ) {
      const { content, filename, mimeType } = this.exportTranslations(
        format,
        languageCode,
        languageName,
        systemName,
        onlyTranslated,
        onlyUntranslated
      );

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
    },
  },
});

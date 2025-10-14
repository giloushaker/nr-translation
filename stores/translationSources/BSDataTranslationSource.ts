import type { TranslationString, TranslationCatalogue } from "../translationStore";
import type { TranslationSource } from "./index";

// BSData translation source implementation
export class BSDataTranslationSource implements TranslationSource {
  private system: any;

  constructor(private systemId: string) {}

  getId(): string {
    return `${this.systemId}`;
  }

  getName(): string {
    return `${this.systemId}`;
  }

  async getTranslations(
    languageCode: string,
    progressCallback?: (progress: number, message?: string) => void
  ): Promise<{
    strings: Record<string, Set<string>>;
    catalogues: TranslationCatalogue[];
    translations: TranslationString[];
  }> {
    // Load system if not already loaded
    if (!this.system) {
      await this.loadSystem(progressCallback);
    }

    // Import and use bs_translate
    const { extractStrings } = await import("~/assets/ts/bs_translate");

    // Extract translations from the system
    const rawStrings = extractStrings(this.system, progressCallback || (() => {}));

    // Process translations into catalogues
    const catalogueList: TranslationCatalogue[] = [];
    const allTranslations: TranslationString[] = [];

    Object.entries(rawStrings).forEach(([catalogueName, translatableMap]) => {
      const strings: TranslationString[] = [];

      // Map.values() returns an iterator of values
      Array.from(translatableMap.values()).forEach((translatable, index) => {
        const translationString: TranslationString = {
          id: `${catalogueName}-${index}`,
          key: translatable.text,
          original: translatable.text,
          translation: "",
          translated: false,
          catalogue: catalogueName,
          type: translatable.type || "other",
        };

        strings.push(translationString);
        allTranslations.push(translationString);
      });

      catalogueList.push({
        id: catalogueName,
        name: catalogueName,
        stringCount: translatableMap.size,
        strings: strings,
      });
    });

    // Convert ITranslatable Map to string Set for compatibility
    const stringSet: Record<string, Set<string>> = {};
    Object.entries(rawStrings).forEach(([catalogueName, translatableMap]) => {
      stringSet[catalogueName] = new Set(Array.from(translatableMap.values()).map(t => t.text));
    });

    // Log the translation source JSON for debugging
    const result = {
      strings: stringSet,
      catalogues: catalogueList,
      translations: allTranslations,
    };

    // Group translations by type for better analysis
    const byType: Record<string, TranslationString[]> = {};
    allTranslations.forEach((t) => {
      const type = t.type || "other";
      if (!byType[type]) byType[type] = [];
      byType[type].push(t);
    });

    console.log("📝 Translation Source JSON:", {
      systemId: this.systemId,
      totalCatalogues: catalogueList.length,
      totalTranslations: allTranslations.length,
      typeBreakdown: Object.fromEntries(
        Object.entries(byType).map(([type, items]) => [type, items.length])
      ),
      examplesByType: Object.fromEntries(
        Object.entries(byType).map(([type, items]) => [
          type,
          items.slice(0, 5).map(t => ({ key: t.key, catalogue: t.catalogue }))
        ])
      ),
      catalogueSummary: catalogueList.map((c) => ({
        name: c.name,
        stringCount: c.stringCount,
      })),
      sampleTranslations: allTranslations.slice(0, 10),
      fullJSON: JSON.stringify(result, (_key, value) => {
        // Convert Set to Array for JSON serialization
        if (value instanceof Set) {
          return Array.from(value);
        }
        return value;
      }, 2),
    });

    return result;
  }

  private async loadSystem(progressCallback?: (progress: number, message?: string) => void): Promise<void> {
    const progress = progressCallback || (() => {});

    try {
      // Check if it's a GitHub repo (contains /)
      if (this.systemId.includes("/")) {
        await this.loadGitHubSystem(progress);
      } else {
        await this.loadLocalSystem(progress);
      }
    } catch (error) {
      console.error("Failed to load system:", error);
      throw error;
    }
  }

  private async loadGitHubSystem(progress: (progress: number, message?: string) => void): Promise<void> {
    const { getRepoZip } = await import("~/assets/shared/battlescribe/github");
    const { convertToJson, isAllowedExtension } = await import("~/assets/shared/battlescribe/bs_convert");
    const { GameSystemFiles } = await import("~/assets/shared/battlescribe/local_game_system");
    const { getCachedSource, setCachedSource } = await import("./sourceCache");

    const [owner, repo] = this.systemId.split("/");

    progress(5, `Checking cache for ${owner}/${repo}...`);

    // Use HEAD for now (like before) - cache will prevent re-downloading
    const releaseTag = "HEAD";

    // Check cache
    progress(10, "Checking cache...");
    const cached = await getCachedSource(owner || "", repo || "");
    if (cached && cached.releaseTag === releaseTag) {
      progress(50, `Loading from cache (${releaseTag})...`);
      const gameSystem = new GameSystemFiles();

      // Restore from cached data
      if (cached.data.gameSystem) {
        await gameSystem.setSystem(cached.data.gameSystem);
      }
      if (cached.data.catalogues) {
        for (const catalogue of cached.data.catalogues) {
          await gameSystem.setCatalogue(catalogue as any);
        }
      }

      progress(100, "Loaded from cache");
      this.system = gameSystem;
      return;
    }

    progress(15, `Downloading ${releaseTag} from GitHub...`);

    const gameSystem = new GameSystemFiles();

    progress(20, "Downloading repository files...");
    const zipEntries = await getRepoZip(owner || "", repo || "", releaseTag);

    progress(40, "Processing game system files...");

    // Process files
    const totalFiles = zipEntries.length;
    let processedFiles = 0;

    for (const [path, entry] of zipEntries) {
      if (entry.isDirectory || !isAllowedExtension(path)) {
        processedFiles++;
        continue;
      }

      const content = await entry.text();
      const data = await convertToJson(content, path);

      if (data.gameSystem) {
        await gameSystem.setSystem(data);
        progress(40 + Math.floor((processedFiles / totalFiles) * 45), `Loading ${data.gameSystem.name}...`);
      } else if (data.catalogue) {
        await gameSystem.setCatalogue(data);
      }

      processedFiles++;
      // Update progress between 40-85%
      progress(40 + Math.floor((processedFiles / totalFiles) * 45));
    }

    progress(90, "Caching for future use...");

    // Cache the loaded system
    try {
      await setCachedSource(owner || "", repo || "", releaseTag, {
        gameSystem: gameSystem.gameSystem,
        catalogues: Object.values(gameSystem.catalogueFiles),
      });
    } catch (e) {
      console.warn("Failed to cache system:", e);
    }

    progress(100, "Ready!");
    this.system = gameSystem;
  }

  private async loadLocalSystem(progress: (progress: number, message?: string) => void): Promise<void> {
    progress(10, "Loading local system...");

    // Get local systems from storage - try new format first, fallback to old
    let localSystemsJson = localStorage.getItem("nr-translation-local-systems");
    if (!localSystemsJson) {
      localSystemsJson = localStorage.getItem("local_systems") || "[]";
    }
    const localSystems = JSON.parse(localSystemsJson);

    const localSystem = localSystems.find((s: any) => s.id === this.systemId);
    if (!localSystem) {
      throw new Error(`Local system not found: ${this.systemId}`);
    }

    progress(50, "Processing system data...");
    const { GameSystemFiles } = await import("~/assets/shared/battlescribe/local_game_system");

    // Create GameSystemFiles instance from stored data
    this.system = new GameSystemFiles();

    // Handle both old and new format
    const systemData = localSystem.data || localSystem;

    if (systemData.gameSystem) {
      await this.system.setSystem(systemData.gameSystem);
    }

    if (systemData.catalogues) {
      // New format: array, Old format: object
      const catalogues = Array.isArray(systemData.catalogues)
        ? systemData.catalogues
        : Object.values(systemData.catalogues);

      for (const catalogue of catalogues) {
        await this.system.setCatalogue(catalogue);
      }
    }

    progress(90, "System loaded successfully");
  }
}

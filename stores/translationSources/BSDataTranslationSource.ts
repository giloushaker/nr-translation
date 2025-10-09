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

    Object.entries(rawStrings).forEach(([catalogueName, stringSet]) => {
      const strings: TranslationString[] = [];

      Array.from(stringSet).forEach((str, index) => {
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
        stringCount: stringSet.size,
        strings: strings,
      });
    });

    return {
      strings: rawStrings,
      catalogues: catalogueList,
      translations: allTranslations,
    };
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

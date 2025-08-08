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

    const [owner, repo] = this.systemId.split("/");

    progress(10, `Connecting to GitHub repository ${owner}/${repo}...`);

    const gameSystem = new GameSystemFiles();

    progress(20, "Downloading repository files...");
    const zipEntries = await getRepoZip(owner || "", repo || "");

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
        progress(40 + Math.floor((processedFiles / totalFiles) * 50), `Loading ${data.gameSystem.name}...`);
      } else if (data.catalogue) {
        await gameSystem.setCatalogue(data);
      }

      processedFiles++;
      // Update progress between 40-90%
      progress(40 + Math.floor((processedFiles / totalFiles) * 50));
    }

    progress(95, "Finalizing...");
    this.system = gameSystem;
  }

  private async loadLocalSystem(progress: (progress: number, message?: string) => void): Promise<void> {
    progress(10, "Loading local system...");

    // Get local systems from storage
    const localSystemsJson = localStorage.getItem("local_systems") || "[]";
    const localSystems = JSON.parse(localSystemsJson);

    const localSystem = localSystems.find((s: any) => s.id === this.systemId);
    if (!localSystem) {
      throw new Error(`Local system not found: ${this.systemId}`);
    }

    progress(50, "Processing system data...");
    const { GameSystemFiles } = await import("~/assets/shared/battlescribe/local_game_system");

    // Create GameSystemFiles instance from stored data
    this.system = new GameSystemFiles();

    if (localSystem.gameSystem) {
      await this.system.setSystem(localSystem.gameSystem);
    }

    if (localSystem.catalogues) {
      for (const catalogue of Object.values(localSystem.catalogues)) {
        await this.system.setCatalogue(catalogue);
      }
    }

    progress(90, "System loaded successfully");
  }
}

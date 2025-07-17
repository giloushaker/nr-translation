import { defineStore } from "pinia";
import { getRepoZip } from "~/assets/shared/battlescribe/github";
import { convertToJson, isAllowedExtension } from "~/assets/shared/battlescribe/bs_convert";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import type { BSIDataSystem, BSIDataCatalogue } from "~/assets/shared/battlescribe/bs_types";

interface SystemState {
  currentSystem: GameSystemFiles | null;
  systemName: string;
  isLoaded: boolean;
}

export const useSystemStore = defineStore("system", {
  state: (): SystemState => ({
    currentSystem: null,
    systemName: "",
    isLoaded: false,
  }),

  getters: {
    gameSystem: (state) => state.currentSystem?.gameSystem,
    hasSystem: (state) => state.isLoaded && state.currentSystem?.gameSystem,
  },

  actions: {
    async loadSystem(
      systemId: string, 
      updateProgress?: (progress: number, message?: string) => void
    ): Promise<void> {
      const progress = updateProgress || (() => {});
      
      try {
        // Check if it's a GitHub repo (contains /)
        if (systemId.includes("/")) {
          await this.loadGitHubSystem(systemId, progress);
        } else {
          await this.loadLocalSystem(systemId, progress);
        }

        // Store in global for backward compatibility
        globalThis.system = this.currentSystem;
        this.isLoaded = true;
        
      } catch (error) {
        console.error("Failed to load system:", error);
        this.currentSystem = null;
        this.systemName = "";
        this.isLoaded = false;
        throw error;
      }
    },

    async loadGitHubSystem(
      systemId: string,
      updateProgress: (progress: number, message?: string) => void
    ): Promise<void> {
      const [owner, repo] = systemId.split("/");

      updateProgress(10, `Connecting to GitHub repository ${owner}/${repo}...`);

      const gameSystem = new GameSystemFiles();

      updateProgress(20, "Downloading repository files...");
      const zipEntries = await getRepoZip(owner, repo);

      updateProgress(40, "Processing game system files...");

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
          await gameSystem.setSystem(data as BSIDataSystem);
          this.systemName = data.gameSystem.name;
          updateProgress(
            40 + Math.floor((processedFiles / totalFiles) * 50),
            `Loading ${data.gameSystem.name}...`
          );
        } else if (data.catalogue) {
          await gameSystem.setCatalogue(data as BSIDataCatalogue);
        }

        processedFiles++;
        // Update progress between 40-90%
        updateProgress(40 + Math.floor((processedFiles / totalFiles) * 50));
      }

      updateProgress(95, "Finalizing...");
      this.currentSystem = gameSystem;
    },

    async loadLocalSystem(
      systemId: string,
      updateProgress: (progress: number, message?: string) => void
    ): Promise<void> {
      updateProgress(20, "Loading local system...");

      const localSystems = JSON.parse(
        localStorage.getItem("nr-translation-local-systems") || "[]"
      );
      const localSystem = localSystems.find((s: any) => s.id === systemId);

      if (!localSystem) {
        throw new Error("System not found");
      }

      const gameSystem = new GameSystemFiles();

      updateProgress(50, `Loading ${localSystem.name}...`);

      if (localSystem.data.gameSystem) {
        await gameSystem.setSystem(localSystem.data.gameSystem);
        this.systemName = localSystem.name;
      }

      updateProgress(70, "Loading catalogues...");

      if (localSystem.data.catalogues) {
        const totalCatalogues = localSystem.data.catalogues.length;
        for (let i = 0; i < totalCatalogues; i++) {
          await gameSystem.setCatalogue(localSystem.data.catalogues[i]);
          updateProgress(70 + Math.floor((i / totalCatalogues) * 20));
        }
      }

      updateProgress(95, "Finalizing...");
      this.currentSystem = gameSystem;
    },

    async ensureSystemLoaded(
      systemId: string,
      updateProgress?: (progress: number, message?: string) => void
    ): Promise<void> {
      // If system is already loaded and matches the requested system, do nothing
      if (this.isLoaded && this.currentSystem?.gameSystem) {
        return;
      }

      // Load the system
      await this.loadSystem(systemId, updateProgress);
    },

    clearSystem(): void {
      this.currentSystem = null;
      this.systemName = "";
      this.isLoaded = false;
      globalThis.system = null;
    },
  },
});
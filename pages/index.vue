<template>
  <div class="container">
    <h1>Load Game System</h1>

    <!-- Quick Select Repositories -->
    <div class="input-section">
      <h2>Quick Select</h2>
      <div class="repo-grid">
        <div v-for="repo in quickSelectRepos" :key="repo.url" class="repo-card" @click="loadQuickRepo(repo)">
          <div class="repo-icon">{{ repo.isTranslationSource ? '🌐' : '📁' }}</div>
          <div class="repo-info">
            <h3>{{ repo.name }}</h3>
            <p>{{ repo.description }}</p>
            <span class="repo-url">{{ repo.displayUrl }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Local Systems -->
    <div v-if="localSystems.length > 0" class="input-section">
      <h2>Local Systems</h2>
      <div class="repo-grid">
        <div v-for="system in localSystems" :key="system.id" class="repo-card local" @click="loadLocalSystem(system)">
          <div class="repo-icon">💾</div>
          <div class="repo-info">
            <h3>{{ system.name }}</h3>
            <p>{{ system.description || "Local system" }}</p>
            <span class="repo-url">Local</span>
          </div>
          <button @click.stop="removeLocalSystem(system.id)" class="remove-btn">×</button>
        </div>
      </div>
    </div>

    <div class="input-section">
      <h2>Load from GitHub Repository</h2>
      <div class="input-group">
        <input v-model="githubUrl" type="text" placeholder="https://github.com/user/repo" class="url-input" />
        <button @click="loadFromGithub" :disabled="loading">
          {{ loading ? "Loading..." : "Load from GitHub" }}
        </button>
      </div>
    </div>

    <div class="input-section">
      <h2>Load from Local Folder</h2>
      <div class="input-group">
        <input
          type="file"
          ref="folderInput"
          webkitdirectory
          directory
          multiple
          @change="loadFromLocal"
          class="file-input"
        />
        <button @click="triggerFolderSelect" :disabled="loading">
          {{ loading ? "Loading..." : "Select Folder" }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="loadedSystem" class="success"> Loaded: {{ loadedSystem.name }} </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { normalizeGithubRepoUrl, parseGitHubUrl, getRepoZip } from "~/assets/shared/battlescribe/github";
import {
  convertToJson,
  isAllowedExtension,
  getExtension,
  removeExtension,
} from "~/assets/shared/battlescribe/bs_convert";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import type { BSIDataSystem, BSIDataCatalogue } from "~/assets/shared/battlescribe/bs_types";

const githubUrl = ref("");
const folderInput = ref<HTMLInputElement>();
const loading = ref(false);
const error = ref("");
const loadedSystem = ref<{ name: string } | null>(null);

const router = useRouter();
const route = useRoute();
const gameSystem = new GameSystemFiles();

// Quick select repositories
const quickSelectRepos = ref([
  {
    name: "NewRecruit",
    description: "NewRecruit application interface strings",
    url: "newrecruit",
    displayUrl: "newrecruit",
    isTranslationSource: true,
  },
  {
    name: "Warhammer 40k 10th Edition",
    description: "Official Warhammer 40,000 10th Edition rules",
    url: "https://github.com/BSData/wh40k-10e",
    displayUrl: "BSData/wh40k-10e",
  },
  {
    name: "Warhammer 40k 9th Edition",
    description: "Warhammer 40,000 9th Edition rules",
    url: "https://github.com/BSData/wh40k-9e",
    displayUrl: "BSData/wh40k-9e",
  },
  {
    name: "Age of Sigmar 4.0",
    description: "Warhammer Age of Sigmar rules",
    url: "https://github.com/BSData/age-of-sigmar-4th",
    displayUrl: "BSData/age-of-sigmar-4th",
  },
  {
    name: "Kill Team (2024)",
    description: "Warhammer 40k Kill Team rules",
    url: "https://github.com/BSData/wh40k-killteam",
    displayUrl: "BSData/wh40k-killteam",
  },
  {
    name: "Horus Heresy (2022)",
    description: "Horus Heresy (2022) game rules",
    url: "https://github.com/BSData/horus-heresy-2nd-edition",
    displayUrl: "BSData/horus-heresy-2nd-edition",
  },
  {
    name: "Trench Crusade",
    description: "Trench Crusade game rules",
    url: "https://github.com/Fawkstrot11/TrenchCrusade",
    displayUrl: "Fawkstrot11/TrenchCrusade",
  },
]);

// Local systems storage
const localSystems = ref<
  Array<{
    id: string;
    name: string;
    description?: string;
    data: any;
  }>
>([]);

const triggerFolderSelect = () => {
  folderInput.value?.click();
};

// Common function to process files
const processFiles = async (files: Array<{ path: string; content: string }>) => {
  for (const { path, content } of files) {
    try {
      const data = await convertToJson(content, path);

      if (data.gameSystem) {
        await gameSystem.setSystem(data as BSIDataSystem);
        loadedSystem.value = { name: data.gameSystem.name };
      } else if (data.catalogue) {
        await gameSystem.setCatalogue(data as BSIDataCatalogue);
      }
    } catch (e: any) {
      console.error(`Failed to process file ${path}:`, e);
    }
  }

  if (!loadedSystem.value) {
    throw new Error("No game system found in files");
  }

  // Store system globally and navigate to languages page
  globalThis.system = gameSystem;
  console.log("loaded", gameSystem.gameSystem?.gameSystem?.name ?? "Unknown System");
  // Navigate to language selection with appropriate system identifier
  // For GitHub repos, use owner/repo format if available
  const githubMatch = githubUrl.value?.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (githubMatch) {
    const systemId = `${githubMatch[1]}/${githubMatch[2]}`;
    await router.push(`/languages/${encodeURIComponent(systemId)}`);
  } else {
    // For local uploads, use the system ID
    const systemId = gameSystem.gameSystem?.gameSystem?.id;
    if (systemId) {
      await router.push(`/languages/${encodeURIComponent(systemId)}`);
    } else {
      await router.push("/");
    }
  }
};

const loadFromGithub = async () => {
  error.value = "";
  loading.value = true;

  try {
    const normalizedUrl = normalizeGithubRepoUrl(githubUrl.value);
    if (!normalizedUrl) {
      throw new Error("Invalid GitHub URL format");
    }

    const { githubOwner, githubName } = parseGitHubUrl(normalizedUrl);

    // Get repository files
    const zipEntries = await getRepoZip(githubOwner, githubName);

    // Convert zip entries to common format
    const files: Array<{ path: string; content: string }> = [];
    for (const [path, entry] of zipEntries) {
      if (entry.isDirectory || !isAllowedExtension(path)) continue;
      const content = await entry.text();
      files.push({ path, content });
    }

    await processFiles(files);
  } catch (e: any) {
    error.value = e.message || "Failed to load from GitHub";
  } finally {
    loading.value = false;
  }
};

const loadFromLocal = async (event: Event) => {
  error.value = "";
  loading.value = true;

  try {
    const input = event.target as HTMLInputElement;
    const fileList = Array.from(input.files || []);

    if (fileList.length === 0) {
      throw new Error("No files selected");
    }

    // Convert files to common format
    const files: Array<{ path: string; content: string }> = [];
    for (const file of fileList) {
      if (!isAllowedExtension(file.name)) continue;
      const content = await file.text();
      files.push({ path: file.name, content });
    }

    await processFiles(files);

    // Save to local storage
    await saveSystemLocally(gameSystem);
  } catch (e: any) {
    error.value = e.message || "Failed to load local files";
  } finally {
    loading.value = false;
  }
};

// Quick select methods
const loadQuickRepo = async (repo: any) => {
  // For translation sources like NewRecruit, navigate directly
  if (repo.isTranslationSource) {
    const systemId = repo.displayUrl;
    await router.push(`/languages/${encodeURIComponent(systemId)}`);
  } else {
    // For quick repos, navigate directly with the owner/repo format
    const systemId = repo.displayUrl; // This contains "owner/repo" format
    await router.push(`/languages/${encodeURIComponent(systemId)}`);
  }
};

const loadLocalSystem = async (system: any) => {
  loading.value = true;
  error.value = "";

  try {
    // Restore the system from saved data
    if (system.data.gameSystem) {
      await gameSystem.setSystem(system.data.gameSystem);
      loadedSystem.value = { name: system.name };
    }

    // Restore catalogues if any
    if (system.data.catalogues) {
      for (const catalogue of system.data.catalogues) {
        await gameSystem.setCatalogue(catalogue);
      }
    }

    globalThis.system = gameSystem;
    await router.push(`/languages/${encodeURIComponent(system.id)}`);
  } catch (e: any) {
    error.value = e.message || "Failed to load local system";
  } finally {
    loading.value = false;
  }
};

const removeLocalSystem = (systemId: string) => {
  const index = localSystems.value.findIndex((s) => s.id === systemId);
  if (index !== -1) {
    localSystems.value.splice(index, 1);
    saveLocalSystems();
  }
};

// Local storage methods
const saveSystemLocally = async (gameSystem: GameSystemFiles) => {
  if (!gameSystem.gameSystem) return;

  const systemData = {
    gameSystem: gameSystem.gameSystem,
    catalogues: Object.values(gameSystem.catalogueFiles),
  };

  const systemId = gameSystem.gameSystem.gameSystem.id;
  const systemName = gameSystem.gameSystem.gameSystem.name;

  const existingIndex = localSystems.value.findIndex((s) => s.id === systemId);
  const systemEntry = {
    id: systemId,
    name: systemName,
    description: "Uploaded from local files",
    data: systemData,
  };

  if (existingIndex !== -1) {
    localSystems.value[existingIndex] = systemEntry;
  } else {
    localSystems.value.push(systemEntry);
  }

  saveLocalSystems();
};

const saveLocalSystems = () => {
  localStorage.setItem("nr-translation-local-systems", JSON.stringify(localSystems.value));
};

const loadLocalSystems = () => {
  try {
    const stored = localStorage.getItem("nr-translation-local-systems");
    if (stored) {
      localSystems.value = JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load local systems:", e);
  }
};

// URL-based system loading
const loadFromUrl = async () => {
  const systemParam = route.query.system as string;
  if (!systemParam) return;

  // Check if it's a local system
  const localSystem = localSystems.value.find((s) => s.id === systemParam);
  if (localSystem) {
    await loadLocalSystem(localSystem);
    return;
  }

  // Check if it's a quick select repo
  const quickRepo = quickSelectRepos.value.find((r) => r.url.includes(systemParam) || r.displayUrl === systemParam);
  if (quickRepo) {
    await loadQuickRepo(quickRepo);
    return;
  }

  // Try to load as GitHub URL
  if (systemParam.startsWith("http")) {
    githubUrl.value = systemParam;
    await loadFromGithub();
  }
};

// Initialize
onMounted(() => {
  loadLocalSystems();
  loadFromUrl();
});
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.input-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.input-group {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.url-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.file-input {
  display: none;
}

button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.error {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
}

.success {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
}

h1 {
  margin-bottom: 2rem;
}

h2 {
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

/* Repository grid styles */
.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.repo-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  position: relative;
}

.repo-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: #007bff;
}

.repo-card.local {
  border-left: 4px solid #28a745;
}

.repo-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.repo-info {
  flex: 1;
}

.repo-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #333;
}

.repo-info p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: #666;
  line-height: 1.4;
}

.repo-url {
  font-size: 0.75rem;
  color: #999;
  font-family: monospace;
}

.remove-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: none;
  font-size: 0.875rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #c82333;
}
</style>

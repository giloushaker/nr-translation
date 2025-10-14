<template>
  <div class="container">
    <div class="page-header">
      <h1>Game Systems</h1>
      <div class="page-actions">
        <span v-if="authStore.user" class="user-info text-muted">{{ authStore.user.login }}</span>
        <button @click="refreshPermissions" class="btn" title="Refresh permissions from server">
          Refresh Permissions
        </button>
        <button @click="refreshDataSource" class="btn" title="Clear cached data and force re-download from GitHub">
          Refresh Data
        </button>
        <button @click="handleLogout" class="btn-secondary"> Logout </button>
      </div>
    </div>

    <div class="grid-2">
      <div
        v-for="repo in quickSelectRepos"
        :key="repo.url"
        class="system-card card-interactive"
        @click="loadQuickRepo(repo)"
      >
        <div class="system-icon">{{ repo.isTranslationSource ? "🌐" : "📁" }}</div>
        <div class="system-info">
          <h3>{{ repo.name }}</h3>
          <p class="text-secondary">{{ repo.description }}</p>
          <span class="system-url text-muted">{{ repo.displayUrl }}</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert-error">
      {{ error }}
    </div>

    <div v-if="loadedSystem" class="alert-success"> Loaded: {{ loadedSystem.name }} </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "~/stores/authStore";
import { normalizeGithubRepoUrl, parseGitHubUrl, getRepoZip } from "~/assets/shared/battlescribe/github";
import {
  convertToJson,
  isAllowedExtension,
  getExtension,
  removeExtension,
} from "~/assets/shared/battlescribe/bs_convert";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import type { BSIDataSystem, BSIDataCatalogue } from "~/assets/shared/battlescribe/bs_types";

definePageMeta({
  middleware: "auth",
});

const githubUrl = ref("");
const folderInput = ref<HTMLInputElement>();
const loading = ref(false);
const error = ref("");
const loadedSystem = ref<{ name: string } | null>(null);

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const gameSystem = new GameSystemFiles();

// All available repositories
const allRepos = [
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
  {
    name: "The Old World",
    description: "The Old World game rules",
    url: "https://github.com/vflam/Warhammer-The-Old-World",
    displayUrl: "vflam/Warhammer-The-Old-World",
  },
];

// Filter repositories based on user permissions
const quickSelectRepos = computed(() => {
  if (!authStore.user || !authStore.user.translation_auth) {
    return [];
  }

  return allRepos.filter((repo) => {
    const systemId = repo.displayUrl;
    return authStore.canTranslateSystem(systemId);
  });
});

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
    if (!githubOwner) throw "No github owner";
    if (!githubName) throw "No githubName";
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

// Refresh data sources (clear cache)
const refreshDataSource = async () => {
  try {
    const { clearAllCache } = await import("~/stores/translationSources/sourceCache");
    await clearAllCache();
    window.location.reload();
  } catch (e) {
    console.error("Failed to clear cache:", e);
    alert("❌ Failed to clear cache. Check console for details.");
  }
};

// Refresh permissions
const refreshPermissions = async () => {
  const success = await authStore.refreshPermissions();
  if (success) {
    alert("✅ Permissions refreshed! The page will reload.");
    window.location.reload();
  } else {
    alert("❌ Failed to refresh permissions. Please try logging out and back in.");
  }
};

// Logout handler
const handleLogout = () => {
  authStore.logout();
  router.push("/");
};

// Initialize
onMounted(() => {
  loadLocalSystems();
  loadFromUrl();
});
</script>

<style scoped>
.user-info {
  font-size: 0.9rem;
  margin-right: 0.5rem;
}

.system-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.system-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.system-info {
  flex: 1;
}

.system-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.system-info p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  line-height: 1.4;
}

.system-url {
  font-size: 0.75rem;
  font-family: monospace;
}
</style>

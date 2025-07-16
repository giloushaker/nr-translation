<template>
  <div class="container">
    <h1>Load Game System</h1>

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
import { ref } from "vue";
import { useRouter } from "vue-router";
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
const gameSystem = new GameSystemFiles();

const triggerFolderSelect = () => {
  folderInput.value?.click();
};

// Common function to process files
const processFiles = async (files: Array<{path: string, content: string}>) => {
  for (const {path, content} of files) {
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
  await router.push("/languages");
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
    const files: Array<{path: string, content: string}> = [];
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
    const files: Array<{path: string, content: string}> = [];
    for (const file of fileList) {
      if (!isAllowedExtension(file.name)) continue;
      const content = await file.text();
      files.push({ path: file.name, content });
    }

    await processFiles(files);
  } catch (e: any) {
    error.value = e.message || "Failed to load local files";
  } finally {
    loading.value = false;
  }
};
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
</style>

<template>
  <div class="container">
    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <h2>Loading Translation Data</h2>
        <div class="loading-message">{{ loadingMessage }}</div>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ loadingProgress }}%</div>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div v-else class="translation-interface">
      <div class="header">
        <button @click="goBack" class="back-button">← Back to Languages</button>
        <h1>Translate to {{ languageName }}</h1>
        <div class="header-stats">
          <span>{{ translatedCount }}/{{ totalStrings }} translated</span>
        </div>
      </div>

      <div class="translation-content scrollable">
        <div class="hierarchy-container">
          <!-- System level -->
          <div class="hierarchy-item system-level">
            <button class="hierarchy-toggle" @click="toggleSystem" :class="{ expanded: systemExpanded }">
              <span class="toggle-icon">{{ systemExpanded ? "▼" : "▶" }}</span>
              <span class="system-name">{{ systemName }}</span>
              <span class="item-count">({{ systemStringCount }} strings)</span>
            </button>

            <!-- Catalogues -->
            <div v-if="systemExpanded" class="hierarchy-children">
              <div v-for="catalogue in catalogues" :key="catalogue.id" class="hierarchy-item catalogue-level">
                <button
                  class="hierarchy-toggle"
                  @click="toggleCatalogue(catalogue.id)"
                  :class="{ expanded: expandedCatalogues.has(catalogue.id) }"
                >
                  <span class="toggle-icon">{{ expandedCatalogues.has(catalogue.id) ? "▼" : "▶" }}</span>
                  <span class="catalogue-name">{{ catalogue.name }}</span>
                  <span class="item-count">({{ catalogue.stringCount }} strings)</span>
                </button>

                <!-- Strings Table -->
                <div v-if="expandedCatalogues.has(catalogue.id)" class="strings-table">
                  <div class="table-header">
                    <div class="col-original">Original Text</div>
                    <div class="col-translation">Translation</div>
                    <div class="col-status">Status</div>
                  </div>
                  <div
                    v-for="(string, index) in catalogue.strings"
                    :key="string.id"
                    class="table-row"
                    :class="{ translated: string.translated, 'row-even': index % 2 === 0 }"
                  >
                    <div class="col-original">
                      <div class="original-text">{{ string.original }}</div>
                    </div>
                    <div class="col-translation">
                      <textarea
                        v-model="string.translation"
                        @input="markAsModified(string)"
                        :placeholder="`Enter ${languageName} translation...`"
                        class="translation-input"
                        rows="2"
                      ></textarea>
                    </div>
                    <div class="col-status">
                      <span v-if="string.translated" class="status-badge translated">✓</span>
                      <span v-else class="status-badge untranslated">—</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { extractTranslations } from "~/assets/ts/bs_translate";

const route = useRoute();
const router = useRouter();

// Loading state
const loading = ref(true);
const loadingProgress = ref(0);
const loadingMessage = ref("Initializing...");

// Translation data
const languageCode = ref("");
const languageName = ref("");
const totalStrings = ref(0);
const translatedCount = ref(0);

// Hierarchy data
const systemName = ref("");
const systemStringCount = ref(0);
const systemExpanded = ref(true);
const expandedCatalogues = ref(new Set<string>());
const catalogues = ref<
  Array<{
    id: string;
    name: string;
    stringCount: number;
    strings: Array<{
      id: string;
      key: string;
      original: string;
      translation: string;
      translated: boolean;
      modified?: boolean;
    }>;
  }>
>([]);

// Loading function with progress callback
const loadTranslationData = async (progressCallback: (progress: number, message: string) => void): Promise<void> => {
  try {
    console.log(1);
    const translations = extractTranslations(globalThis.system, progressCallback);
    globalThis.strings = translations;

    // Populate hierarchy data
    const gameSystem = globalThis.system?.gameSystem;
    systemName.value = gameSystem ? getDataObject(gameSystem).name : "Unknown System";

    const mockCatalogues = Object.entries(translations).map(([k, v]) => ({
      id: k,
      name: k,
      stringCount: v.size,
      strings: Array.from(v).map((str) => ({
        original: str,
      })),
    }));
    console.log(mockCatalogues);
    catalogues.value = mockCatalogues;
    systemStringCount.value = mockCatalogues.reduce((total, cat) => total + cat.stringCount, 0);
    totalStrings.value = systemStringCount.value;
    translatedCount.value = mockCatalogues.reduce(
      (total, cat) => total + cat.strings.filter((s) => s.translated).length,
      0
    );
  } catch (error) {
    console.error("Failed to load translation data:", error);
    throw error;
  }
};

onMounted(async () => {
  // Get language from route
  languageCode.value = route.params.lang as string;

  // Map language codes to names (this would come from actual data)
  const languageNames: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    zh: "Chinese",
  };

  languageName.value = languageNames[languageCode.value] || languageCode.value;

  // Check if system is loaded
  if (!globalThis.system?.gameSystem) {
    await router.push("/");
    return;
  }

  try {
    // Load translation data with progress updates
    await loadTranslationData((progress, message) => {
      loadingProgress.value = progress;
      loadingMessage.value = message;
    });

    // Small delay to show completion
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Hide loading screen
    loading.value = false;
  } catch (error) {
    console.error("Failed to initialize translation page:", error);
    // Handle error - maybe redirect back
    await router.push("/languages");
  }
});

const goBack = () => {
  router.push("/languages");
};

// Hierarchy toggle methods
const toggleSystem = () => {
  systemExpanded.value = !systemExpanded.value;
};

const toggleCatalogue = (catalogueId: string) => {
  if (expandedCatalogues.value.has(catalogueId)) {
    expandedCatalogues.value.delete(catalogueId);
  } else {
    expandedCatalogues.value.add(catalogueId);
  }
};

const markAsModified = (string: any) => {
  string.modified = true;
  string.translated = string.translation.trim() !== "";

  // Recalculate translated count
  translatedCount.value = catalogues.value.reduce(
    (total, cat) => total + cat.strings.filter((s) => s.translated).length,
    0
  );
};
</script>

<style scoped>
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Loading overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
  max-width: 400px;
  width: 100%;
  padding: 2rem;
}

.loading-content h2 {
  margin-bottom: 1rem;
  color: #333;
}

.loading-message {
  color: #666;
  margin-bottom: 2rem;
  min-height: 1.5rem;
}

.progress-container {
  position: relative;
}

.progress-bar {
  height: 24px;
  background: #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #45a049);
  transition: width 0.3s ease;
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

/* Main interface */
.translation-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  background: #f8f9fa;
  padding: 1rem 2rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 2rem;
}

.back-button {
  padding: 0.5rem 1rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.back-button:hover {
  background: #f0f0f0;
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
  flex: 1;
}

.header-stats {
  color: #666;
  font-size: 0.875rem;
}

.translation-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

/* Hierarchy styles */
.hierarchy-container {
  padding: 1rem;
}

.hierarchy-item {
  margin-bottom: 0.5rem;
}

.hierarchy-toggle {
  width: 100%;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hierarchy-toggle:hover {
  background: #e9ecef;
}

.hierarchy-toggle.expanded {
  background: #e7f3ff;
  border-color: #0066cc;
}

.toggle-icon {
  width: 16px;
  font-size: 0.875rem;
  color: #666;
}

.system-name {
  font-weight: 600;
  color: #333;
  flex: 1;
}

.catalogue-name {
  font-weight: 500;
  color: #444;
  flex: 1;
}

.item-count {
  font-size: 0.875rem;
  color: #666;
}

.hierarchy-children {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
}

.system-level .hierarchy-toggle {
  background: #f0f8ff;
  border-color: #0066cc;
}

.catalogue-level .hierarchy-toggle {
  background: #f9f9f9;
  border-color: #ccc;
}

/* Strings Table */
.strings-table {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 1fr 80px;
  background: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
  color: #495057;
}

.table-header > div {
  padding: 0.75rem;
  font-size: 0.875rem;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 80px;
  border-bottom: 1px solid #f0f0f0;
  min-height: 60px;
  align-items: stretch;
  transition: background-color 0.2s;
}

.table-row:hover {
  background: #f8f9fa;
}

.table-row.row-even {
  background: #fafafa;
}

.table-row.row-even:hover {
  background: #f0f0f0;
}

.table-row.translated {
  border-left: 4px solid #28a745;
}

.table-row:last-child {
  border-bottom: none;
}

.col-original,
.col-translation {
  padding: 0.5rem 0.75rem;
  display: flex;
  align-items: flex-start;
}

.col-status {
  padding: 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-original {
  border-right: 1px solid #f0f0f0;
}

.col-translation {
  border-right: 1px solid #f0f0f0;
}

.original-text {
  font-size: 0.875rem;
  line-height: 1.4;
  color: #333;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  width: 100%;
}

.translation-input {
  width: 100%;
  height: calc(100% - 1rem);
  padding: 0.375rem 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.4;
  transition: border-color 0.2s, box-shadow 0.2s;
  resize: vertical;
  min-height: 40px;
  white-space: pre-wrap;
}

.translation-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
}

.translation-input::placeholder {
  color: #999;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: bold;
}

.status-badge.translated {
  background: #28a745;
  color: white;
}

.status-badge.untranslated {
  background: #6c757d;
  color: white;
}
</style>

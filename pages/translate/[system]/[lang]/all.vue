<template>
  <div class="container">
    <!-- Export Dialog -->
    <ExportDialog :show="showExportDialog" @close="showExportDialog = false" @export="handleExport" />

    <!-- Submit Dialog -->
    <SubmitDialog
      :show="showSubmitDialog"
      :is-submitting="isSubmitting"
      @close="showSubmitDialog = false"
      @submit="handleSubmit"
    />

    <!-- Sync Dialog -->
    <!-- <SyncDialog
      :show="showSyncDialog"
      :sync-conflicts="syncConflicts"
      :selected-file="selectedFile"
      :is-syncing="isSyncing"
      :can-sync="canSync"
      @close="closeSyncDialog"
      @file-select="handleFileSelect"
      @sync="handleSyncSubmit"
    /> -->

    <!-- Main content -->
    <div class="translation-interface">
      <div class="header">
        <button @click="goBack" class="back-button">← Back to Languages</button>
        <h1>Translate to {{ languageName }}</h1>
        <div class="header-stats">
          <span>{{ translatedCount }}/{{ totalStrings }} translated</span>
        </div>
        <div class="header-actions">
          <button
            @click="showSyncDialog = true"
            class="sync-button"
            :title="canSync ? 'Sync translations from backend' : 'Import translations from file'"
          >
            Sync Translations
          </button>
          <button
            @click="showSubmitDialog = true"
            class="submit-button"
            :disabled="!canSubmit"
            :title="canSubmit ? 'Submit translations to backend' : 'No backend configured'"
          >
            Submit Translations
          </button>
          <button @click="showExportDialog = true" class="export-button"> Export Translations </button>
        </div>
      </div>

      <!-- Filter Controls -->
      <div class="filter-controls">
        <div class="filter-group">
          <label for="filter-select">Show:</label>
          <select id="filter-select" v-model="selectedFilter" class="filter-select">
            <option value="all">All Strings</option>
            <option value="translated">Translated Only</option>
            <option value="untranslated">Untranslated Only</option>
            <option value="modified">Modified Only</option>
            <option value="untranslated-modified">Untranslated + Modified</option>
          </select>
        </div>
        <div class="filter-stats">
          <span class="filter-count">{{ filteredCount }} of {{ totalStrings }} strings shown</span>
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
              <div v-for="catalogue in filteredCatalogues" :key="catalogue.id" class="hierarchy-item catalogue-level">
                <button
                  class="hierarchy-toggle"
                  @click="toggleCatalogue(catalogue.id)"
                  :class="{ expanded: expandedCatalogues.has(catalogue.id) }"
                >
                  <span class="toggle-icon">{{ expandedCatalogues.has(catalogue.id) ? "▼" : "▶" }}</span>
                  <span class="catalogue-name">{{ catalogue.name }}</span>
                  <span class="item-count"
                    >(showing {{ catalogue.visibleStringCount }} of {{ catalogue.filteredStringCount }} strings)</span
                  >
                </button>

                <!-- Strings Table -->
                <div
                  v-if="expandedCatalogues.has(catalogue.id) && catalogue.filteredStrings.length > 0"
                  class="strings-table"
                >
                  <div class="table-header">
                    <div class="col-original">Original Text</div>
                    <div class="col-translation">Translation</div>
                    <div class="col-status">Status</div>
                    <div class="col-actions">Actions</div>
                  </div>
                  <div
                    v-for="(string, index) in catalogue.filteredStrings"
                    :key="string.id"
                    class="table-row"
                    :class="{ translated: string.translated, modified: string.modified, 'row-even': index % 2 === 0 }"
                  >
                    <div class="col-original">
                      <div class="original-text">{{ string.original }}</div>
                    </div>
                    <div class="col-translation">
                      <textarea
                        v-model="string.translation"
                        @change="markAsModified(string)"
                        :placeholder="`Enter ${languageName} translation...`"
                        class="translation-input"
                        rows="2"
                      ></textarea>
                    </div>
                    <div class="col-status">
                      <button
                        @click="toggleTranslationStatus(string)"
                        class="status-toggle"
                        :class="{ translated: string.translated }"
                        :title="string.translated ? 'Mark as untranslated' : 'Mark as translated'"
                      >
                        <span v-if="string.translated" class="status-icon check">✓</span>
                        <span v-else class="status-icon cross">✗</span>
                      </button>
                    </div>
                    <div class="col-actions">
                      <button @click="editString(string)" class="edit-button" title="Edit individually"> ✎ </button>
                    </div>
                  </div>
                </div>

                <!-- Load More Button -->
                <div v-if="expandedCatalogues.has(catalogue.id) && catalogue.hasMore" class="load-more-container">
                  <button @click="loadMoreStrings(catalogue.id)" class="load-more-button">
                    Load More ({{ catalogue.filteredStringCount - catalogue.visibleStringCount }} remaining)
                  </button>
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
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTranslationStore, type ExportFormat } from "~/stores/translationStore";
import ExportDialog from "~/components/ExportDialog.vue";
import SubmitDialog from "~/components/SubmitDialog.vue";
import SyncDialog from "~/components/SyncDialog.vue";

const route = useRoute();
const router = useRouter();
const translationStore = useTranslationStore();

// Hierarchy data
const systemExpanded = ref(true);
const expandedCatalogues = ref(new Set<string>());

// Performance optimization - pagination for large catalogues
const STRINGS_PER_PAGE = 50; // Show 50 strings initially per catalogue
const cataloguePagination = ref<Record<string, number>>({}); // Track loaded count per catalogue

// Filter state
const selectedFilter = ref<string>("all");
const cachedFilteredCatalogues = ref<any[]>([]);
const cachedFilteredCount = ref<number>(0);

// Dialog states
const showExportDialog = ref(false);
const showSubmitDialog = ref(false);
const showSyncDialog = ref(false);
const syncConflicts = ref<Array<{ key: string; original: string; local: string; server: string }>>([]);
const selectedFile = ref<File | null>(null);

// Computed properties from store
const systemName = computed(() => translationStore.systemName);
const catalogues = computed(() => translationStore.catalogues);
const totalStrings = computed(() => translationStore.totalStrings);
const translatedCount = computed(() => translationStore.translatedCount);
const systemStringCount = computed(() => translationStore.systemStringCount);

// Filter function
const filterString = (string: any, filterType: string) => {
  switch (filterType) {
    case "translated":
      return string.translated;
    case "untranslated":
      return !string.translated;
    case "modified":
      return string.modified;
    case "untranslated-modified":
      return !string.translated || string.modified;
    default:
      return true;
  }
};

// Apply filter function with pagination
const applyFilter = () => {
  const filtered = catalogues.value
    .map((catalogue) => {
      const filteredStrings = catalogue.strings.filter((string) => filterString(string, selectedFilter.value));

      // Get how many strings to show for this catalogue (pagination)
      const loadedCount = cataloguePagination.value[catalogue.id] || STRINGS_PER_PAGE;
      const visibleStrings = filteredStrings.slice(0, Math.min(loadedCount, filteredStrings.length));

      return {
        ...catalogue,
        filteredStrings: visibleStrings,
        filteredStringCount: filteredStrings.length, // Total count for stats
        visibleStringCount: visibleStrings.length, // Currently shown count
        hasMore: filteredStrings.length > visibleStrings.length, // Can load more?
      };
    })
    .filter((catalogue) => catalogue.filteredStringCount > 0);

  cachedFilteredCatalogues.value = filtered;
  cachedFilteredCount.value = filtered.reduce((total, catalogue) => total + catalogue.filteredStringCount, 0);
};

// Computed properties that use cached values
const filteredCatalogues = computed(() => cachedFilteredCatalogues.value);
const filteredCount = computed(() => cachedFilteredCount.value);

// Backend computed properties
const canSubmit = computed(() => translationStore.canSubmit);
const isSubmitting = computed(() => translationStore.isSubmitting);
const canSync = computed(() => translationStore.canSync || false);
const isSyncing = computed(() => translationStore.isSyncing);

// Get language info from route
const languageCode = computed(() => route.params.lang as string);
const languageName = computed(() => {
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
  return languageNames[languageCode.value] || languageCode.value;
});

const goBack = () => {
  const systemId = route.params.system as string;
  router.push(`/languages/${encodeURIComponent(systemId)}`);
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
    // Initialize pagination for newly expanded catalogue if not set
    if (!cataloguePagination.value[catalogueId]) {
      cataloguePagination.value[catalogueId] = STRINGS_PER_PAGE;
    }
  }
};

const loadMoreStrings = (catalogueId: string) => {
  const currentCount = cataloguePagination.value[catalogueId] || STRINGS_PER_PAGE;
  cataloguePagination.value[catalogueId] = currentCount + STRINGS_PER_PAGE;
  applyFilter(); // Refresh the filtered data to show more items
};

const markAsModified = (string: any) => {
  translationStore.updateTranslation(string.id, string.translation, route.params.system as string, languageCode.value);
};

const toggleTranslationStatus = (string: any) => {
  // If currently translated, clear it. If not translated, copy original as translation
  if (string.translated) {
    translationStore.updateTranslation(string.id, "", route.params.system as string, languageCode.value);
  } else {
    translationStore.updateTranslation(string.id, string.original, route.params.system as string, languageCode.value);
  }
};

const editString = (string: any) => {
  const systemId = route.params.system as string;
  router.push(`/translate/${encodeURIComponent(systemId)}/${languageCode.value}/${encodeURIComponent(string.key)}`);
};

const handleFileSelect = (file: File) => {
  selectedFile.value = file;
};

const closeSyncDialog = () => {
  showSyncDialog.value = false;
  selectedFile.value = null;
  syncConflicts.value = [];
};

const handleSyncSubmit = async (data: {
  syncStrategy: "server-wins" | "client-wins" | "ask-user";
  selectedFile: File | null;
}) => {
  try {
    let result;

    if (data.selectedFile) {
      // Use file-based sync
      result = await translationStore.syncFromFile(
        data.selectedFile,
        route.params.system as string,
        languageCode.value,
        data.syncStrategy
      );
    } else {
      // Use backend sync
      result = await translationStore.syncFromBackend(
        route.params.system as string,
        languageCode.value,
        data.syncStrategy
      );
    }

    if (result.conflicts.length > 0 && data.syncStrategy === "ask-user") {
      syncConflicts.value = result.conflicts;
      // Keep dialog open to show conflicts
      return;
    }

    showSyncDialog.value = false;
    syncConflicts.value = [];
    selectedFile.value = null;
  } catch (error: any) {
    console.error("Failed to sync translations:", error);
    alert("Failed to sync translations: " + error.message);
  }
};

const handleSubmit = async (data: { onlyModified: boolean }) => {
  try {
    await translationStore.submitToBackend(route.params.system as string, languageCode.value, data.onlyModified);
    showSubmitDialog.value = false;
  } catch (error: any) {
    console.error("Failed to submit translations:", error);
    // Show error message to user
    alert("Failed to submit translations: " + error.message);
  }
};

const handleExport = (data: { format: ExportFormat; onlyTranslated: boolean; onlyUntranslated: boolean }) => {
  translationStore.downloadExport(
    data.format,
    languageCode.value,
    languageName.value,
    translationStore.systemName,
    data.onlyTranslated,
    data.onlyUntranslated
  );

  showExportDialog.value = false;
};

// Watch for filter changes
watch(selectedFilter, () => {
  applyFilter();
});

// Watch for data changes (when translations are loaded or updated)
watch(
  catalogues,
  () => {
    applyFilter();
  },
  { deep: true }
);

// Initialize filter on mount
onMounted(() => {
  applyFilter();
});
</script>

<style scoped>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
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
  flex: 1;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.sync-button {
  padding: 0.5rem 1rem;
  background: #17a2b8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.sync-button:hover:not(:disabled) {
  background: #138496;
}

.sync-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.submit-button {
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #218838;
}

.submit-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.export-button {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.export-button:hover {
  background: #0056b3;
}

/* Filter Controls */
.filter-controls {
  background: #f8f9fa;
  padding: 1rem 2rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 2rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 500;
  color: #495057;
  font-size: 0.875rem;
}

.filter-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  font-size: 0.875rem;
  color: #495057;
  cursor: pointer;
  min-width: 160px;
}

.filter-select:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
}

.filter-stats {
  margin-left: auto;
  color: #6c757d;
  font-size: 0.875rem;
}

.filter-count {
  font-weight: 500;
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
  grid-template-columns: 1fr 1fr 80px 60px;
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
  grid-template-columns: 1fr 1fr 80px 60px;
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

.table-row.modified {
  border-left: 4px solid #ffc107;
}

.table-row.translated.modified {
  border-left: 4px solid #17a2b8;
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

.col-actions {
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

.col-status {
  border-right: 1px solid #f0f0f0;
}

.edit-button {
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  color: #007bff;
}

.edit-button:hover {
  background: #f8f9fa;
  border-color: #007bff;
  color: #0056b3;
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

.status-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.status-toggle:hover {
  transform: scale(1.1);
}

.status-icon {
  font-size: 1.25rem;
  font-weight: bold;
}

.status-icon.check {
  color: #28a745;
}

.status-icon.cross {
  color: #dc3545;
}

/* Load More Button */
.load-more-container {
  margin: 1rem 0;
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
}

.load-more-button {
  padding: 0.75rem 2rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.load-more-button:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

.load-more-button:active {
  transform: translateY(0);
}
</style>

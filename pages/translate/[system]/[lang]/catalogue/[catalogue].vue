<template>
  <div class="container">
    <!-- Sync Dialog -->
    <SyncDialog
      :show="showSyncDialog"
      :sync-conflicts="syncConflicts"
      :selected-file="selectedFile"
      :is-syncing="isSyncing"
      :can-sync="hasBackend"
      :sync-summary="syncSummary"
      @close="closeSyncDialog"
      @file-select="handleFileSelect"
      @sync="handleSyncSubmit"
      @resolve-conflicts="handleConflictResolution"
    />

    <PageHeader
      :breadcrumbs="breadcrumbs"
      :title="currentCatalogue?.name || 'Loading...'"
      :stats="`${catalogueTranslatedCount}/${catalogueStrings.length} translated (${catalogueProgress}%)`"
    >
      <template #actions>
        <button
          @click="showSyncDialog = true"
          class="btn-primary"
          :disabled="isSyncing"
          :title="hasBackend ? 'Sync translations from backend' : 'Import translations from file'"
        >
          {{ isSyncing ? "Syncing..." : "Sync Translations" }}
        </button>
      </template>
    </PageHeader>

    <div class="content" v-if="currentCatalogue">
      <div class="filter-controls">
        <div class="filter-group">
          <label for="filter-select">Show:</label>
          <select id="filter-select" v-model="selectedFilter" class="filter-select">
            <option value="all">All Strings</option>
            <option value="translated">Translated Only</option>
            <option value="untranslated">Untranslated Only</option>
            <option value="modified">Modified Only</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="type-filter">Type:</label>
          <select id="type-filter" v-model="selectedType" class="filter-select">
            <option value="all">All Types</option>
            <option v-for="type in availableTypes" :key="type" :value="type">
              {{ formatTypeName(type) }} ({{ typeCount(type) }})
            </option>
          </select>
        </div>
        <div class="filter-group search-group">
          <label for="search-input">Search:</label>
          <input
            id="search-input"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search in keys or text..."
          />
        </div>
        <div class="filter-stats">
          <span class="filter-count">{{ filteredStrings.length }} of {{ catalogueStrings.length }} strings shown</span>
        </div>
      </div>

      <div class="strings-container">
        <div class="strings-table">
          <div class="table-header">
            <div class="col-original">Original Text</div>
            <div class="col-type">Type</div>
            <div class="col-translation">Translation</div>
            <div class="col-status">Status</div>
            <div class="col-actions">Actions</div>
          </div>
          <div
            v-for="(string, index) in filteredStrings"
            :key="string.id"
            class="table-row"
            :class="{ translated: string.translated, modified: string.modified, 'row-even': index % 2 === 0 }"
          >
            <div class="col-original">
              <div class="original-text">{{ string.original }}</div>
            </div>
            <div class="col-type">
              <span class="type-badge" :class="`type-${string.type || 'other'}`">
                {{ formatTypeName(string.type || 'other') }}
              </span>
            </div>
            <div class="col-translation">
              <textarea
                :value="getTranslationValue(string)"
                @input="onTranslationInput(string, $event)"
                @blur="saveTranslation(string)"
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
      </div>
    </div>

    <div v-else class="loading"> Loading catalogue... </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTranslationStore } from "~/stores/translationStore";
import { useStatsStore } from "~/stores/statsStore";
import PageHeader from "~/components/PageHeader.vue";
import SyncDialog from "~/components/SyncDialog.vue";

const route = useRoute();
const router = useRouter();
const translationStore = useTranslationStore();
const statsStore = useStatsStore();

// Dialog states
const showSyncDialog = ref(false);
const syncConflicts = ref<Array<{ key: string; original: string; local: string; server: string }>>([]);
const selectedFile = ref<File | null>(null);
const syncSummary = ref<{ received: number; uploaded: number; conflicts: number } | null>(null);
const serverTranslationsFromSync = ref<Set<string>>(new Set());

// Get route params
const catalogueId = computed(() => route.params.catalogue as string);
const languageCode = computed(() => route.params.lang as string);
const systemId = computed(() => route.params.system as string);

// Filter state
const selectedFilter = ref<string>("all");
const selectedType = ref<string>("all");
const searchQuery = ref<string>("");

// Local editing state - store only values being edited
const editingValues = ref<Map<string, string>>(new Map());

// Computed properties
const isSyncing = computed(() => translationStore.isSyncing);
const hasBackend = computed(() => translationStore.backend?.isAvailable() || false);

// Language mapping
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

// Breadcrumb navigation
const breadcrumbs = computed(() => [
  {
    label: "Systems",
    onClick: () => router.push("/systems"),
  },
  {
    label: languageName.value,
    onClick: () => router.push(`/languages/${encodeURIComponent(systemId.value)}`),
  },
  {
    label: "Catalogues",
    onClick: () => router.push(`/translate/${encodeURIComponent(systemId.value)}/${languageCode.value}/catalogues`),
  },
  {
    label: currentCatalogue.value?.name || "...",
    onClick: () => {},
  },
]);

// Current catalogue
const currentCatalogue = computed(() => {
  const decodedId = decodeURIComponent(catalogueId.value);
  return translationStore.catalogues.find((cat) => cat.id === decodedId);
});

const catalogueStrings = computed(() => {
  return currentCatalogue.value?.strings || [];
});

const catalogueTranslatedCount = computed(() => {
  return catalogueStrings.value.filter((s) => s.translated).length;
});

const catalogueProgress = computed(() => {
  const total = catalogueStrings.value.length;
  const translated = catalogueTranslatedCount.value;
  return total > 0 ? Math.round((translated / total) * 100) : 0;
});

// Format type names for display
const formatTypeName = (type: string): string => {
  const typeMap: Record<string, string> = {
    unit: "Unit",
    option: "Option",
    profileName: "Profile Name",
    profile: "Profile",
    ruleName: "Rule Name",
    rule: "Rule",
    category: "Category",
    faction: "Faction",
    force: "Force",
    other: "Other",
  };
  return typeMap[type] || type;
};

// Preferred order for types
const typeOrder = [
  "unit",
  "faction",
  "force",
  "category",
  "profileName",
  "ruleName",
  "profile",
  "rule",
  "option",
  "other",
];

// Available types in this catalogue
const availableTypes = computed(() => {
  const types = new Set<string>();
  catalogueStrings.value.forEach((s) => {
    types.add(s.type || "other");
  });

  // Sort by predefined order
  return Array.from(types).sort((a, b) => {
    const indexA = typeOrder.indexOf(a);
    const indexB = typeOrder.indexOf(b);
    // If type not in order array, put at end
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
});

// Count strings by type
const typeCount = (type: string) => {
  return catalogueStrings.value.filter((s) => (s.type || "other") === type).length;
};

// LocalStorage key for type filter
const getTypeFilterKey = () => {
  return `typeFilter:${systemId.value}:${languageCode.value}:${catalogueId.value}`;
};

// Initialize type filter from localStorage
const initializeTypeFilter = () => {
  if (typeof window === 'undefined') return;

  const storageKey = getTypeFilterKey();
  const savedType = localStorage.getItem(storageKey);

  // If we have a saved value and it exists in available types, use it
  if (savedType && (savedType === "all" || availableTypes.value.includes(savedType))) {
    selectedType.value = savedType;
  }
  // Otherwise, default to "unit" if available
  else if (availableTypes.value.includes("unit")) {
    selectedType.value = "unit";
  }
  // Otherwise default to "all"
  else {
    selectedType.value = "all";
  }
};

// Save type filter to localStorage when it changes
watch(selectedType, (newType) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getTypeFilterKey(), newType);
});

// Watch for catalogue changes and reinitialize type filter
watch([catalogueStrings, availableTypes], () => {
  if (catalogueStrings.value.length > 0) {
    initializeTypeFilter();
  }
}, { immediate: true });

onMounted(() => {
  initializeTypeFilter();
});

// Filter strings
const filteredStrings = computed(() => {
  return catalogueStrings.value.filter((string) => {
    // Filter by status
    let passesStatusFilter = false;
    switch (selectedFilter.value) {
      case "translated":
        passesStatusFilter = string.translated;
        break;
      case "untranslated":
        passesStatusFilter = !string.translated;
        break;
      case "modified":
        passesStatusFilter = string.modified || false;
        break;
      default:
        passesStatusFilter = true;
    }

    // Filter by type
    const passesTypeFilter =
      selectedType.value === "all" || (string.type || "other") === selectedType.value;

    // Filter by search query
    let passesSearchFilter = true;
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase();
      const searchableText = [
        string.key || "",
        string.original || "",
        string.translation || ""
      ].join(" ").toLowerCase();
      passesSearchFilter = searchableText.includes(query);
    }

    return passesStatusFilter && passesTypeFilter && passesSearchFilter;
  });
});

// No pagination needed since we're focusing on one catalogue

const editString = (string: any) => {
  const systemId = route.params.system as string;
  router.push(`/translate/${encodeURIComponent(systemId)}/${languageCode.value}/${encodeURIComponent(string.key)}`);
};

// Get value for textarea - from local state if editing, otherwise from store
const getTranslationValue = (string: any): string => {
  return editingValues.value.get(string.id) ?? string.translation ?? "";
};

// Update local state while typing (no store update)
const onTranslationInput = (string: any, event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  editingValues.value.set(string.id, target.value);
};

// Save to store when leaving the field
const saveTranslation = (string: any) => {
  const value = editingValues.value.get(string.id);
  if (value !== undefined) {
    translationStore.updateTranslation(string.id, value, route.params.system as string, languageCode.value);
    editingValues.value.delete(string.id);
  }
};

const toggleTranslationStatus = (string: any) => {
  // If currently translated, clear it. If not translated, copy original as translation
  if (string.translated) {
    translationStore.updateTranslation(string.id, "", route.params.system as string, languageCode.value);
  } else {
    translationStore.updateTranslation(string.id, string.original, route.params.system as string, languageCode.value);
  }
};

// Sync Dialog handlers
const closeSyncDialog = () => {
  showSyncDialog.value = false;
  syncConflicts.value = [];
  selectedFile.value = null;
  syncSummary.value = null;
  serverTranslationsFromSync.value = new Set();
};

const handleFileSelect = (file: File | null) => {
  selectedFile.value = file;
};

const handleSyncSubmit = async (data: { syncStrategy: "server-wins" | "client-wins" | "ask-user"; selectedFile?: File }) => {
  try {
    let result: {
      conflicts: Array<{ key: string; original: string; local: string; server: string }>;
      received?: number;
      uploaded?: number;
      resolvedConflicts?: number;
      serverTranslations?: Array<{ key: string; [key: string]: any }>;
    };

    if (data.selectedFile) {
      // Use file-based sync
      result = await translationStore.syncFromFile(
        data.selectedFile,
        systemId.value,
        languageCode.value,
        data.syncStrategy
      );
    } else {
      // Use backend sync
      result = await translationStore.syncFromBackend(
        systemId.value,
        languageCode.value,
        data.syncStrategy
      );
    }

    if (result.conflicts.length > 0 && data.syncStrategy === "ask-user") {
      syncConflicts.value = result.conflicts;
      // Store server translations for proper upload logic during conflict resolution
      if (result.serverTranslations) {
        serverTranslationsFromSync.value = new Set(result.serverTranslations.map((t: { key: string }) => t.key));
      }
      // Keep dialog open to show conflicts
      return;
    }

    // Clear conflicts and file selection
    syncConflicts.value = [];
    selectedFile.value = null;

    // Update stats cache with new translation counts
    statsStore.updateTranslationCount(
      systemId.value,
      languageCode.value,
      translationStore.translatedCount
    );

    // Show summary instead of closing dialog
    syncSummary.value = {
      received: result.received || 0,
      uploaded: result.uploaded || 0,
      conflicts: result.resolvedConflicts || 0,
    };

    // Don't close dialog - show summary instead
  } catch (error: any) {
    console.error("Failed to sync translations:", error);
    alert("Failed to sync translations: " + error.message);
  }
};

const handleConflictResolution = async (
  resolutions: Array<{ key: string; choice: "local" | "server"; server: string }>
) => {
  try {
    // Apply the conflict resolutions
    translationStore.resolveConflicts(resolutions);

    // Complete the sync process by saving and uploading
    await translationStore.saveTranslationsToLocal(systemId.value, languageCode.value);

    // Upload any remaining local changes
    await translationStore.uploadLocalTranslationsToServer(
      systemId.value,
      languageCode.value,
      serverTranslationsFromSync.value
    );

    // Update stats cache with new translation counts
    statsStore.updateTranslationCount(
      systemId.value,
      languageCode.value,
      translationStore.translatedCount
    );

    // Clear conflicts and show summary
    const resolvedCount = resolutions.length;
    const uploadedCount = translationStore.getLastUploadCount();

    syncConflicts.value = [];
    selectedFile.value = null;
    serverTranslationsFromSync.value = new Set();

    // Show completion summary
    syncSummary.value = {
      received: resolvedCount,
      uploaded: uploadedCount,
      conflicts: resolvedCount,
    };
  } catch (error: any) {
    console.error("Failed to resolve conflicts:", error);
    alert("Failed to resolve conflicts: " + error.message);
  }
};
</script>

<style scoped>
.container {
  width: 100%;
  margin: 0 auto;
  padding: 1rem;
  max-width: 1200px;
}

@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

@media (min-width: 1264px) {
  .container {
    width: 1200px;
    padding: 2rem;
  }
}

.filter-controls {
  background: #f8f9fa;
  padding: 1rem 2rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
  border-radius: 4px;
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

.search-input {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  font-size: 0.875rem;
  color: #495057;
  min-width: 200px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
}

.search-group {
  flex-grow: 1;
}

.filter-stats {
  margin-left: auto;
  color: #6c757d;
  font-size: 0.875rem;
}

.strings-container {
  flex: 1;
  overflow-y: auto;
  height: 600px;
  max-height: 70vh;
}

/* Strings Table */
.strings-table {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 110px 1fr 80px 60px;
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
  grid-template-columns: 1fr 110px 1fr 80px 60px;
  border-bottom: 1px solid #f0f0f0;
  min-height: 40px;
  align-items: center;
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
  border-left: 4px solid #28a745;
}

.table-row:last-child {
  border-bottom: none;
}

.col-original,
.col-translation {
  padding: 0.375rem 0.75rem;
  display: flex;
  align-items: center;
}

.col-status {
  padding: 0.375rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-actions {
  padding: 0.375rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-original {
  border-right: 1px solid #f0f0f0;
}

.col-type {
  padding: 0.375rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #f0f0f0;
}

.col-translation {
  border-right: 1px solid #f0f0f0;
}

.col-status {
  border-right: 1px solid #f0f0f0;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.2;
}

.type-unit {
  background: #e3f2fd;
  color: #1976d2;
}

.type-option {
  background: #f3e5f5;
  color: #7b1fa2;
}

.type-profileName {
  background: #fff3e0;
  color: #f57c00;
}

.type-profile {
  background: #ffe0b2;
  color: #e65100;
}

.type-ruleName {
  background: #e8f5e9;
  color: #388e3c;
}

.type-rule {
  background: #c8e6c9;
  color: #2e7d32;
}

.type-category {
  background: #fce4ec;
  color: #c2185b;
}

.type-faction {
  background: #f3e5f5;
  color: #6a1b9a;
}

.type-force {
  background: #e1f5fe;
  color: #0277bd;
}

.type-other {
  background: #eceff1;
  color: #546e7a;
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

.translation-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.4;
  transition: border-color 0.2s, box-shadow 0.2s;
  resize: vertical;
  min-height: 36px;
}

.translation-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
}

.loading {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

/* Responsive design */
@media (max-width: 768px) {
  .strings-grid {
    grid-template-columns: 1fr;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .filter-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>

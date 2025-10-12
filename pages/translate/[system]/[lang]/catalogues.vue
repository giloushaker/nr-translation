<template>
  <div class="container">
    <!-- Export Dialog -->
    <ExportDialog :show="showExportDialog" @close="showExportDialog = false" @export="handleExport" />

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
      title="Catalogues"
      :subtitle="`${languageName} (${languageCode})`"
      :stats="`${translatedCount}/${totalStrings} total translated`"
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
        <button @click="showExportDialog = true" class="btn-success" title="Export translations to file">
          Export Translations
        </button>
      </template>
    </PageHeader>

    <div class="catalogues-grid" v-if="catalogues.length > 0">
      <div
        v-for="catalogue in catalogues"
        :key="catalogue.id"
        class="catalogue-card"
        @click="selectCatalogue(catalogue.id)"
      >
        <div class="catalogue-header">
          <h3>{{ catalogue.name }}</h3>
          <span class="catalogue-type">{{ getCatalogueType(catalogue.name) }}</span>
        </div>

        <div class="stats-container">
          <div class="stat-row">
            <span class="stat-label">Translated:</span>
            <div class="progress-bar">
              <div class="progress-fill translated" :style="{ width: getCatalogueProgress(catalogue) + '%' }"></div>
              <span class="progress-text">{{ getCatalogueProgress(catalogue) }}%</span>
            </div>
          </div>

          <div class="stat-details">
            <div class="stat-item">
              <span class="stat-value">{{ catalogue.strings.length }}</span>
              <span class="stat-sublabel">Total strings</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ getCatalogueTranslatedCount(catalogue) }}</span>
              <span class="stat-sublabel">Translated</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ catalogue.strings.length - getCatalogueTranslatedCount(catalogue) }}</span>
              <span class="stat-sublabel">Remaining</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-catalogues">
      <p>No catalogues available.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTranslationStore, type ExportFormat } from "~/stores/translationStore";
import { useStatsStore } from "~/stores/statsStore";
import SyncDialog from "~/components/SyncDialog.vue";
import ExportDialog from "~/components/ExportDialog.vue";
import PageHeader from "~/components/PageHeader.vue";

const route = useRoute();
const router = useRouter();
const translationStore = useTranslationStore();
const statsStore = useStatsStore();

// Dialog states
const showExportDialog = ref(false);
const showSyncDialog = ref(false);
const syncConflicts = ref<Array<{ key: string; original: string; local: string; server: string }>>([]);
const selectedFile = ref<File | null>(null);
const syncSummary = ref<{ received: number; uploaded: number; conflicts: number } | null>(null);
const serverTranslationsFromSync = ref<Set<string>>(new Set());

// Computed properties from store
const catalogues = computed(() => translationStore.catalogues);
const totalStrings = computed(() => translationStore.totalStrings);
const translatedCount = computed(() => translationStore.translatedCount);

// Backend computed properties
const canSync = computed(() => translationStore.canSync || false);
const isSyncing = computed(() => translationStore.isSyncing);
const hasBackend = computed(() => translationStore.backend?.isAvailable() || false);

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

// Breadcrumb navigation
const breadcrumbs = computed(() => {
  const systemId = route.params.system as string;
  return [
    {
      label: "Systems",
      onClick: () => router.push("/systems"),
    },
    {
      label: languageName.value,
      onClick: () => router.push(`/languages/${encodeURIComponent(systemId)}`),
    },
    {
      label: "Catalogues",
      onClick: () => {},
    },
  ];
});

const selectCatalogue = (catalogueId: string) => {
  const systemId = route.params.system as string;
  router.push(
    `/translate/${encodeURIComponent(systemId)}/${languageCode.value}/catalogue/${encodeURIComponent(catalogueId)}`
  );
};

const getCatalogueTranslatedCount = (catalogue: any): number => {
  return catalogue.strings.filter((s: any) => s.translated).length;
};

const getCatalogueProgress = (catalogue: any): number => {
  const translated = getCatalogueTranslatedCount(catalogue);
  const total = catalogue.strings.length;
  return total > 0 ? Math.round((translated / total) * 100) : 0;
};

const getCatalogueType = (name: string): string => {
  // Extract type from catalogue name for better UX
  if (name.includes("Forces")) return "Army";
  if (name.includes("Detachment")) return "Detachment";
  if (name.includes("Stratagems")) return "Stratagems";
  if (name.includes("Weapon")) return "Weapons";
  if (name.includes("Rule")) return "Rules";
  return "Catalogue";
};

// Sync functionality
const handleFileSelect = (file: File) => {
  selectedFile.value = file;
};

const closeSyncDialog = () => {
  showSyncDialog.value = false;
  selectedFile.value = null;
  syncConflicts.value = [];
  syncSummary.value = null;
  serverTranslationsFromSync.value = new Set();
};

const handleSyncSubmit = async (data: {
  syncStrategy: "server-wins" | "client-wins" | "ask-user";
  selectedFile: File | null;
}) => {
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
      route.params.system as string,
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
    // showSyncDialog.value = false;
  } catch (error: any) {
    console.error("Failed to sync translations:", error);

    // Show user notification for errors
    if (globalThis.notify) {
      globalThis.notify({
        title: "Sync Failed",
        text: error.message || "Unknown error occurred",
        type: "error",
        duration: 5000,
      });
    } else {
      alert("Failed to sync translations: " + error.message);
    }
  }
};

const handleConflictResolution = async (
  resolutions: Array<{ key: string; choice: "local" | "server"; server: string }>
) => {
  try {
    // Apply the conflict resolutions
    translationStore.resolveConflicts(resolutions);

    // Complete the sync process by saving and uploading
    await translationStore.saveTranslationsToLocal(route.params.system as string, languageCode.value);

    // Upload any remaining local changes
    // Use the complete server translation set from the initial sync, not just conflicted keys
    await translationStore.uploadLocalTranslationsToServer(
      route.params.system as string,
      languageCode.value,
      serverTranslationsFromSync.value
    );

    // Update stats cache with new translation counts
    statsStore.updateTranslationCount(
      route.params.system as string,
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

    if (globalThis.notify) {
      globalThis.notify({
        title: "Conflict Resolution Failed",
        text: error.message || "Unknown error occurred",
        type: "error",
        duration: 5000,
      });
    } else {
      alert("Failed to resolve conflicts: " + error.message);
    }
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
</script>

<style scoped>
.container {
  width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.catalogues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.catalogue-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.catalogue-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.catalogue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.catalogue-header h3 {
  margin: 0;
  font-size: 1.25rem;
  flex: 1;
}

.catalogue-type {
  background: #f0f0f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: monospace;
}

.stats-container {
  margin-top: 1rem;
}

.stat-row {
  margin-bottom: 0.75rem;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.progress-bar {
  position: relative;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.translated {
  background: #4caf50;
}

.progress-text {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  font-weight: 500;
  color: #333;
}

.stat-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.stat-sublabel {
  display: block;
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
}

.no-catalogues {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

/* Responsive design */
@media (max-width: 768px) {
  .catalogues-grid {
    grid-template-columns: 1fr;
  }

  .catalogue-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .catalogue-stats {
    margin-top: 0.5rem;
  }
}
</style>

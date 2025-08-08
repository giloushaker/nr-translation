<template>
  <div class="container">
    <div class="header">
      <button @click="goBack" class="back-button">← Back to Catalogues</button>
      <div class="header-info">
        <h1>{{ currentCatalogue?.name || "Loading..." }}</h1>
        <div class="progress-info">
          {{ catalogueTranslatedCount }}/{{ catalogueStrings.length }} translated ({{ catalogueProgress }}%)
        </div>
      </div>
    </div>

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
        <div class="filter-stats">
          <span class="filter-count">{{ filteredStrings.length }} of {{ catalogueStrings.length }} strings shown</span>
        </div>
      </div>

      <div class="strings-container">
        <div class="strings-table">
          <div class="table-header">
            <div class="col-original">Original Text</div>
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
            <div class="col-translation">
              <textarea
                @change="markAsModified(string)"
                v-model="string.translation"
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
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTranslationStore } from "~/stores/translationStore";

const route = useRoute();
const router = useRouter();
const translationStore = useTranslationStore();

// Filter state
const selectedFilter = ref<string>("all");

// Get route params
const catalogueId = computed(() => route.params.catalogue as string);
const languageCode = computed(() => route.params.lang as string);

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

// Filter strings
const filteredStrings = computed(() => {
  return catalogueStrings.value.filter((string) => {
    switch (selectedFilter.value) {
      case "translated":
        return string.translated;
      case "untranslated":
        return !string.translated;
      case "modified":
        return string.modified;
      default:
        return true;
    }
  });
});

// No pagination needed since we're focusing on one catalogue

const goBack = () => {
  const systemId = route.params.system as string;
  router.push(`/translate/${encodeURIComponent(systemId)}/${languageCode.value}/catalogues`);
};

const editString = (string: any) => {
  const systemId = route.params.system as string;
  router.push(`/translate/${encodeURIComponent(systemId)}/${languageCode.value}/${encodeURIComponent(string.key)}`);
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
</script>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  background: #f8f9fa;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #dee2e6;
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
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

.header-info {
  flex: 1;
}

.header-info h1 {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
}

.progress-info {
  color: #666;
  font-size: 0.875rem;
  font-weight: 500;
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

.filter-stats {
  margin-left: auto;
  color: #6c757d;
  font-size: 0.875rem;
}

.strings-container {
  flex: 1;
  overflow-y: auto;
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
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.4;
  transition: border-color 0.2s, box-shadow 0.2s;
  resize: vertical;
  min-height: 60px;
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

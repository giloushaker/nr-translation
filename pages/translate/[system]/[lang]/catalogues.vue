<template>
  <div class="container">
    <div class="header">
      <button @click="goBack" class="back-button">← Back to Languages</button>
      <h1>Select Catalogue to Translate</h1>
      <div class="header-stats">
        <span>{{ translatedCount }}/{{ totalStrings }} total translated</span>
      </div>
    </div>

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
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTranslationStore } from "~/stores/translationStore";

const route = useRoute();
const router = useRouter();
const translationStore = useTranslationStore();

// Computed properties from store
const catalogues = computed(() => translationStore.catalogues);
const totalStrings = computed(() => translationStore.totalStrings);
const translatedCount = computed(() => translationStore.translatedCount);

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
</script>

<style scoped>
.container {
  width: 1200px;
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

.header h1 {
  margin: 0;
  font-size: 1.75rem;
  flex: 1;
}

.header-stats {
  color: #666;
  font-size: 0.875rem;
  font-weight: 500;
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

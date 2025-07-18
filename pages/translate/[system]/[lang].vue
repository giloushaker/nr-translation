<template>
  <div class="translate-container">
    <LoadingOverlay title="Loading Translation Data" />
    <NuxtPage v-if="!loadingStore.isLoading && isTranslationDataReady" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useLoadingStore } from "~/stores/loadingStore";
import { useTranslationStore } from "~/stores/translationStore";

// Ensure this parent route is also kept alive
definePageMeta({
  keepalive: true,
});

const route = useRoute();
const router = useRouter();
const loadingStore = useLoadingStore();
const translationStore = useTranslationStore();

const isTranslationDataReady = ref(false);

const loadTranslationData = async (updateProgress: (progress: number, message?: string) => void): Promise<void> => {
  try {
    updateProgress(20, "Loading translation strings...");
    await translationStore.ensureTranslationsLoaded(
      route.params.system as string,
      route.params.lang as string,
      (progress, message) => {
        updateProgress(20 + Math.floor(progress * 0.75), message);
      }
    );
    updateProgress(100, "Translation data loaded!");
  } catch (error) {
    console.error("Failed to load translation data:", error);
    throw error;
  }
};

const initializeTranslationPage = async () => {
  // Get system and language from route
  const systemId = route.params.system as string;
  const languageCode = route.params.lang as string;

  // Only redirect if we're actually on a translate route but missing parameters
  const isTranslateRoute = route.path.includes("/translate/");
  if (isTranslateRoute && (!systemId || !languageCode)) {
    console.log("Redirecting to home due to missing params on translate route");
    await router.push("/");
    return;
  }

  // If we're not on a translate route, don't try to load translation data
  if (!isTranslateRoute) {
    isTranslationDataReady.value = true;
    return;
  }

  try {
    await loadingStore.withLoading(async (updateProgress) => {
      // Load translation data - this handles both NewRecruit and BSData systems
      await loadTranslationData(updateProgress);

      // Auto-sync from backend if available
      if (translationStore.canSync) {
        updateProgress(95, "Syncing from backend...");
        try {
          await translationStore.syncFromBackend(systemId, languageCode, "client-wins");
          console.log("Auto-sync completed successfully");
        } catch (error) {
          console.warn("Auto-sync failed:", error);
          // Don't show error to user for auto-sync, it's not critical
        }
      }

      // Small delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 300));
    }, "Initializing...");

    isTranslationDataReady.value = true;
  } catch (error) {
    console.error("Failed to initialize translation page:", error);
    // Handle error - redirect to home if system doesn't exist
    await router.push("/");
  }
};

onMounted(() => {
  initializeTranslationPage();
});

// Watch for route changes to handle keepalive navigation
// Only watch system and lang params, not the full path
watch(
  () => [route.params.system, route.params.lang],
  async ([newSystem, newLang], [oldSystem, oldLang] = []) => {
    // Only react if system or language actually changed AND we're on a translate route
    const paramsChanged = newSystem !== oldSystem || newLang !== oldLang;
    const isOnTranslateRoute = route.path.includes("/translate/");

    if (paramsChanged && isOnTranslateRoute && oldSystem !== undefined) {
      console.log("System/Language changed:", {
        from: [oldSystem, oldLang],
        to: [newSystem, newLang],
      });
      isTranslationDataReady.value = false;
      await initializeTranslationPage();
    }
  }
);
</script>

<style scoped>
.translate-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>

<template>
  <div v-if="loadingStore.isLoading" class="loading-overlay">
    <div class="loading-content">
      <h2>{{ title }}</h2>
      <div class="loading-message">{{ loadingStore.message }}</div>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: loadingStore.progress + '%' }"></div>
        </div>
        <div class="progress-text">{{ loadingStore.progress }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLoadingStore } from "~/stores/loadingStore";

interface Props {
  title?: string;
}

withDefaults(defineProps<Props>(), {
  title: "Loading",
});

const loadingStore = useLoadingStore();
</script>

<style scoped>
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
</style>
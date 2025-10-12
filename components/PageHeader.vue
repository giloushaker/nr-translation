<template>
  <div class="page-header-container">
    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <button
        v-for="(crumb, index) in breadcrumbs"
        :key="index"
        @click="crumb.onClick"
        :class="['breadcrumb-item', { active: index === breadcrumbs.length - 1 }]"
      >
        {{ crumb.label }}
      </button>
    </nav>

    <!-- Title and Stats -->
    <div class="header-content">
      <div class="header-left">
        <h1>{{ title }}</h1>
        <p v-if="subtitle" class="subtitle text-muted">{{ subtitle }}</p>
      </div>

      <div class="header-right">
        <div v-if="stats" class="header-stats text-muted">
          {{ stats }}
        </div>
        <div class="header-actions">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Breadcrumb {
  label: string;
  onClick: () => void;
}

interface Props {
  title: string;
  subtitle?: string;
  stats?: string;
  breadcrumbs: Breadcrumb[];
}

defineProps<Props>();
</script>

<style scoped>
.page-header-container {
  background: var(--background-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
}

.breadcrumb-item {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0;
  transition: all var(--transition-normal);
  position: relative;
}

.breadcrumb-item:hover:not(.active) {
  text-decoration: underline;
}

.breadcrumb-item.active {
  color: var(--text-primary);
  font-weight: 500;
  cursor: default;
}

.breadcrumb-item:not(:last-child)::after {
  content: '›';
  margin-left: 0.5rem;
  color: var(--text-muted);
  font-weight: bold;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.header-left {
  flex: 1;
}

.header-left h1 {
  margin: 0 0 0.25rem 0;
  font-size: 1.75rem;
}

.subtitle {
  margin: 0;
  font-size: 0.875rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.header-stats {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
</style>

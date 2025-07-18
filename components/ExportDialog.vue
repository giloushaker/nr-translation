<template>
  <div v-if="show" class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h2>Export Translations</h2>
        <button @click="$emit('close')" class="dialog-close">×</button>
      </div>
      <div class="dialog-content">
        <p>Select export format:</p>
        <div class="format-options">
          <label class="format-option">
            <input type="radio" v-model="selectedFormat" value="json" />
            <span>JSON (Full)</span>
            <small>Complete translation data with metadata</small>
          </label>
          <label class="format-option">
            <input type="radio" v-model="selectedFormat" value="json-kv" />
            <span>JSON (Key-Value)</span>
            <small>Simple key-value pairs format</small>
          </label>
          <label class="format-option">
            <input type="radio" v-model="selectedFormat" value="csv" />
            <span>CSV</span>
            <small>Spreadsheet-compatible format</small>
          </label>
          <label class="format-option">
            <input type="radio" v-model="selectedFormat" value="po" />
            <span>PO (gettext)</span>
            <small>GNU gettext format for translation tools</small>
          </label>
        </div>
        <div class="export-options">
          <label class="checkbox-option">
            <input type="checkbox" v-model="onlyTranslated" :disabled="onlyUntranslated" />
            <span>Export only translated strings</span>
          </label>
          <label class="checkbox-option">
            <input type="checkbox" v-model="onlyUntranslated" :disabled="onlyTranslated" />
            <span>Export only untranslated strings</span>
          </label>
        </div>
      </div>
      <div class="dialog-footer">
        <button @click="$emit('close')" class="dialog-button cancel">Cancel</button>
        <button @click="handleExport" class="dialog-button primary">Export</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue'
import type { ExportFormat } from '~/stores/translationStore'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'export', data: {
    format: ExportFormat
    onlyTranslated: boolean
    onlyUntranslated: boolean
  }): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedFormat = ref<ExportFormat>('json')
const onlyTranslated = ref(false)
const onlyUntranslated = ref(false)

const handleExport = () => {
  emit('export', {
    format: selectedFormat.value,
    onlyTranslated: onlyTranslated.value,
    onlyUntranslated: onlyUntranslated.value
  })
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  min-width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-close:hover {
  color: #495057;
}

.dialog-content {
  padding: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

.format-options {
  margin: 1rem 0;
}

.format-option {
  display: block;
  margin-bottom: 1rem;
  cursor: pointer;
}

.format-option input[type="radio"] {
  margin-right: 0.5rem;
}

.format-option span {
  font-weight: 500;
  margin-right: 0.5rem;
}

.format-option small {
  display: block;
  margin-left: 1.5rem;
  color: #6c757d;
  font-size: 0.8rem;
}

.export-options {
  border-top: 1px solid #dee2e6;
  padding-top: 1rem;
  margin-top: 1rem;
}

.checkbox-option {
  display: block;
  margin-bottom: 0.5rem;
  cursor: pointer;
}

.checkbox-option input[type="checkbox"] {
  margin-right: 0.5rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.dialog-button {
  padding: 0.5rem 1.25rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.dialog-button:hover {
  background: #f8f9fa;
}

.dialog-button.cancel {
  color: #6c757d;
}

.dialog-button.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.dialog-button.primary:hover {
  background: #0056b3;
  border-color: #0056b3;
}
</style>
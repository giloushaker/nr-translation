<template>
  <div class="redirect-container">
    <div class="redirect-message">
      <div class="spinner"></div>
      <p>Loading catalogues...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  // Short delay to show the loading message
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Redirect directly to catalogues
  const systemId = route.params.system as string;
  const languageCode = route.params.lang as string;
  
  await router.replace(`/translate/${encodeURIComponent(systemId)}/${languageCode}/catalogues`);
});
</script>

<style scoped>
.redirect-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f8f9fa;
}

.redirect-message {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.redirect-message p {
  margin: 0;
  color: #666;
  font-size: 0.875rem;
}
</style>
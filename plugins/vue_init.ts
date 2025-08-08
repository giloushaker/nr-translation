// @ts-ignore
import Notifications from "@kyvg/vue3-notification";
import type { Router } from "vue-router";
import type { Pinia } from "pinia";
import { notify } from "@kyvg/vue3-notification";
import { HttpBackend } from "~/stores/translationBackends";


export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Notifications);
  (nuxtApp.$pinia as Pinia).use(({ store }) => {
    store.$router = nuxtApp.$router as Router;
    
    // Set up HTTP backend for translation store
    if (store.$id === 'translation') {
      const httpBackend = new HttpBackend('http://localhost:3001/api');
      store.setBackend(httpBackend);
      console.log('✅ HTTP Backend configured for localhost:3001');
    }
  });
  globalThis.notify = notify;
  console.log('globals:', 'system', 'strings', 'translations')
});

// @ts-ignore
import Notifications from "@kyvg/vue3-notification";
import type { Router } from "vue-router";
import type { Pinia } from "pinia";
import { notify } from "@kyvg/vue3-notification";


export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Notifications);
  (nuxtApp.$pinia as Pinia).use(({ store }) => {
    store.$router = nuxtApp.$router as Router;
  });
  const oldLog = globalThis.console.log
  globalThis.console.log = (...args: any[]) => oldLog(...args.map((arg) => toRaw(arg)))
  globalThis.notify = notify;
});

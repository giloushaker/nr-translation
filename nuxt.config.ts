// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";
import pkg from "./package.json";
const ghpages = process.argv.includes("--ghpages");

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  sourcemap: {
    server: true,
    client: true,
  },
  runtimeConfig: {
    public: {
      ghpages: ghpages,
      clientVersion: pkg.version,
    },
  },
  modules: [
    "nuxt-windicss",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
  ],
  app: {
    head: {
      title: "New Recruit - Translation",
      base: {
        href: `/nr-translation/`,
      },

    },
  },
  typescript: {
    strict: true,
  },
  css: ["~/style.css"],

  vite: { plugins: [(await import("vite-plugin-commonjs")).default()] },
  components: [{ path: "~/shared_components/" }, { path: "~/components/" }],
});

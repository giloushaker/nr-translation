export default defineNuxtRouteMiddleware((to, from) => {
  // Skip middleware on server side
  if (process.server) return;

  const authStore = useAuthStore();

  // Allow access to login page
  if (to.path === "/") {
    return;
  }

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    // Redirect to login page
    return navigateTo("/");
  }
});

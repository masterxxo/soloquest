// Routes reachable without a session. Everything else is protected.
const PUBLIC_ROUTES = ['/login', '/register'];

export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await useAuthSession();

  const isPublic = PUBLIC_ROUTES.includes(to.path);
  const isLoggedIn = !!session.value?.user;

  // Logged-in users have no business on the auth screens.
  if (isLoggedIn && isPublic) {
    return navigateTo('/');
  }

  // Guard everything else behind a session.
  if (!isLoggedIn && !isPublic) {
    return navigateTo('/login');
  }
});

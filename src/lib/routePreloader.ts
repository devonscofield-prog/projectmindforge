/**
 * Route preloading utilities for optimizing navigation
 * Preloads route chunks on hover/focus to reduce perceived load time
 */

type ModuleLoader = () => Promise<unknown>;

// Registry of route paths to their lazy import functions
const routeModules: Record<string, ModuleLoader> = {
  // Rep routes
  "/rep": () => import("@/pages/rep/RepDashboard"),
  "/rep/history": () => import("@/pages/rep/RepCallHistory"),
  "/rep/prospects": () => import("@/pages/rep/RepProspects"),
  "/rep/coaching-summary": () => import("@/pages/rep/RepCoachingSummary"),
  
  // Manager routes
  "/manager": () => import("@/pages/manager/ManagerDashboard"),
  "/manager/accounts": () => import("@/pages/manager/ManagerAccounts"),
  "/manager/coaching": () => import("@/pages/manager/ManagerCoaching"),
  
  // Admin routes
  "/admin": () => import("@/pages/admin/AdminDashboard"),
  "/admin/teams": () => import("@/pages/admin/AdminTeams"),
  "/admin/users": () => import("@/pages/admin/AdminUsers"),
  "/admin/accounts": () => import("@/pages/admin/AdminAccounts"),
  "/admin/coaching": () => import("@/pages/admin/AdminCoachingTrends"),
  "/admin/transcripts": () => import("@/pages/admin/AdminTranscriptAnalysis"),
};

// Track preloaded routes to avoid duplicate requests
const preloadedRoutes = new Set<string>();

/**
 * Preload a specific route's chunk
 */
export function preloadRoute(path: string): void {
  // Normalize path
  const normalizedPath = path.split("?")[0].replace(/\/$/, "") || "/";
  
  // Check if already preloaded
  if (preloadedRoutes.has(normalizedPath)) {
    return;
  }

  // Find matching route (handle dynamic segments)
  let loader = routeModules[normalizedPath];
  
  // Handle dynamic routes like /rep/prospects/:id
  if (!loader) {
    const pathParts = normalizedPath.split("/");
    for (const [routePath, routeLoader] of Object.entries(routeModules)) {
      const routeParts = routePath.split("/");
      if (pathParts.length === routeParts.length) {
        const matches = routeParts.every((part, i) => 
          part.startsWith(":") || part === pathParts[i]
        );
        if (matches) {
          loader = routeLoader;
          break;
        }
      }
    }
  }

  if (loader) {
    preloadedRoutes.add(normalizedPath);
    // Use requestIdleCallback for non-blocking preload
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => {
        loader().catch(() => {
          // Silently fail - route will load normally on navigation
          preloadedRoutes.delete(normalizedPath);
        });
      });
    } else {
      // Fallback for Safari
      setTimeout(() => {
        loader().catch(() => {
          preloadedRoutes.delete(normalizedPath);
        });
      }, 100);
    }
  }
}

/**
 * Preload routes based on user role
 * Call this after authentication to preload likely routes
 */
export function preloadRoleRoutes(role: "rep" | "manager" | "admin"): void {
  const roleRoutes: Record<string, string[]> = {
    rep: ["/rep", "/rep/history", "/rep/prospects", "/rep/coaching-summary"],
    manager: ["/manager", "/manager/accounts", "/manager/coaching"],
    admin: ["/admin", "/admin/teams", "/admin/users", "/admin/accounts"],
  };

  const routes = roleRoutes[role] || [];
  
  // Stagger preloading to avoid blocking
  routes.forEach((route, index) => {
    setTimeout(() => preloadRoute(route), index * 200);
  });
}

/**
 * Create onMouseEnter/onFocus handlers for link preloading
 */
export function createPreloadHandlers(path: string) {
  let preloaded = false;
  
  const handlePreload = () => {
    if (!preloaded) {
      preloaded = true;
      preloadRoute(path);
    }
  };

  return {
    onMouseEnter: handlePreload,
    onFocus: handlePreload,
  };
}

/**
 * Hook to get preload handlers for a route
 */
export function useRoutePreload(path: string) {
  return createPreloadHandlers(path);
}

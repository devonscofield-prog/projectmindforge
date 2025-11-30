import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Bundle analyzer - generates stats.html in project root
    mode === "analyze" && visualizer({
      filename: "dist/stats.html",
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // treemap, sunburst, network
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable source maps for debugging (disable in production for smaller builds)
    sourcemap: mode !== "production",
    // Chunk size warning threshold (in kB)
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Core React runtime
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // UI framework
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-label",
            "@radix-ui/react-separator",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-slot",
          ],
          // Data fetching & state
          "vendor-query": ["@tanstack/react-query"],
          // Charts
          "vendor-charts": ["recharts"],
          // Forms
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          // Date utilities
          "vendor-date": ["date-fns", "react-day-picker"],
          // Backend client
          "vendor-supabase": ["@supabase/supabase-js"],
          // Icons (can be large)
          "vendor-icons": ["lucide-react"],
        },
        // Chunk naming for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId || "";
          // Name page chunks by their route
          if (facadeModuleId.includes("/pages/rep/")) {
            return "chunks/rep-[name]-[hash].js";
          }
          if (facadeModuleId.includes("/pages/manager/")) {
            return "chunks/manager-[name]-[hash].js";
          }
          if (facadeModuleId.includes("/pages/admin/")) {
            return "chunks/admin-[name]-[hash].js";
          }
          if (facadeModuleId.includes("/components/")) {
            return "chunks/components-[name]-[hash].js";
          }
          return "chunks/[name]-[hash].js";
        },
        // Asset naming
        assetFileNames: "assets/[name]-[hash][extname]",
        // Entry naming
        entryFileNames: "js/[name]-[hash].js",
      },
    },
    // Target modern browsers for smaller bundles
    target: "es2020",
    // Minification
    minify: "esbuild",
  },
  // Optimize deps pre-bundling
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
    ],
  },
}));

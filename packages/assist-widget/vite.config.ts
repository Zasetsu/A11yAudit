import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/loader.ts",
      name: "A11yAuditAssist",
      formats: ["iife"],
      fileName: () => "a11yaudit-assist.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    },
    sourcemap: true,
    emptyOutDir: false
  }
});

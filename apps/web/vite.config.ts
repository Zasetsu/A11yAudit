import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "A11YAUDIT_SERVER_URL"],
  plugins: [react()]
});

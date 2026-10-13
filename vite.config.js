import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works on GitHub Pages under any repo name
  base: "./",
  server: {
    port: 5173,        // your custom port (local dev only)
    strictPort: true,  // show an error instead of picking another port if busy
  },
});

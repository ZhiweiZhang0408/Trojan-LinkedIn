import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ["mammoth/mammoth.browser", "pdfjs-dist"] },
  server: { port: 5173, strictPort: true },
});

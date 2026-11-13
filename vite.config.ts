import { defineConfig } from "vite";

export default defineConfig({
  base: "/squarenaut/",
  build: {
    rollupOptions: {
      input: {
        game: "index.html",
        editor: "editor.html",
      },
    },
  },
});

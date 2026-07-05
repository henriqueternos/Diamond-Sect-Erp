import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" (relativo) funciona em qualquer nome de repositório do GitHub
// Pages, sem precisar editar isso toda vez que o repo mudar de nome.
export default defineConfig({
  plugins: [react()],
  base: "./",
});

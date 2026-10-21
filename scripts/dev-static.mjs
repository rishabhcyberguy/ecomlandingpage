import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const port = process.env.PORT || "3000";
const child = spawn(
  process.execPath,
  [viteCli, "--host", "0.0.0.0", "--port", port, "--strictPort"],
  { env: process.env, stdio: "inherit" },
);

child.on("error", (error) => {
  console.error("Failed to start the static Vite development server:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

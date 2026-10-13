import { execSync } from "node:child_process";

const target = process.argv[2] || "all";
console.log(`[build-target] Building NEXMENU for target: ${target}`);

process.env.VITE_APP_TARGET = target;

try {
  execSync("pnpm exec vite build", {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_APP_TARGET: target,
    },
  });
  console.log(`[build-target] Successfully completed build for target: ${target}`);
} catch {
  console.error(`[build-target] Build failed for target: ${target}`);
  process.exit(1);
}

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
execFileSync("python3", [join(projectRoot, "scripts", "render-brand-assets.py")], { stdio: "inherit" });

console.log("Generated native exports from the supplied petal artwork and Yariva wordmark.");

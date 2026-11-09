import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

for (const path of ["../../../.env", "../.env"]) {
  try {
    loadEnvFile(fileURLToPath(new URL(path, import.meta.url)));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

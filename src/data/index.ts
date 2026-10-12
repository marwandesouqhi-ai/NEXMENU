import type { DataAdapter } from "./adapters/types";
import { LocalAdapter } from "./adapters/local";

const configured = import.meta.env.VITE_DATA_ADAPTER ?? "local";
if (configured !== "local") throw new Error(`Data adapter "${configured}" is not available in this build.`);
export const dataAdapter: DataAdapter = new LocalAdapter();

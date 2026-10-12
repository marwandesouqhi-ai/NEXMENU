import type { DataAdapter } from "./adapters/types";
import { LocalAdapter } from "./adapters/local";
import { SupabaseAdapter } from "./adapters/supabase";

const configured = import.meta.env.VITE_DATA_ADAPTER ?? "local";

export const dataAdapter: DataAdapter =
  configured === "supabase" ? new SupabaseAdapter() : new LocalAdapter();


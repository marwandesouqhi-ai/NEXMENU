import { z } from "zod";

const reserved = new Set(["admin", "dashboard", "login", "signup", "r", "api", "auth"]);
export const slugSchema = z.string().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !reserved.has(value), "This slug is reserved.");
export const toSlug = (value: string) => value.toLowerCase().trim()
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

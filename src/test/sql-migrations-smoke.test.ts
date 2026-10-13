import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

describe("PostgreSQL Full Migrations Smoke Suite (001-009)", { timeout: 30000 }, () => {
  it("applies the entire migration chain 001..009 to a clean DB and executes get_public_menu", async () => {
    const db = new PGlite();
    try {
      // Setup Supabase environment prerequisites
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text,
        raw_user_meta_data jsonb DEFAULT '{}'
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
          CREATE ROLE supabase_admin NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user') THEN
          CREATE ROLE dashboard_user NOLOGIN;
        END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.buckets (
        id text PRIMARY KEY,
        name text,
        public boolean DEFAULT false,
        file_size_limit bigint,
        allowed_mime_types text[]
      );
      CREATE TABLE IF NOT EXISTS storage.objects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text REFERENCES storage.buckets(id),
        name text,
        owner uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        last_accessed_at timestamptz DEFAULT now(),
        metadata jsonb
      );
      CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
        SELECT string_to_array(name, '/');
      $$;
      CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
        SELECT split_part(name, '.', array_length(string_to_array(name, '.'), 1));
      $$;
    `);

    const migrationDir = path.resolve("supabase/migrations");
    const migrationFiles = fs.readdirSync(migrationDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    expect(migrationFiles.length).toBeGreaterThanOrEqual(9);

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(migrationDir, file), "utf-8");
      // In PostgreSQL 13+, gen_random_uuid() is built-in. PGlite Wasm does not bundle pgcrypto.control.
      sql = sql.replace(/create extension if not exists pgcrypto;/gi, "-- pgcrypto built into modern PG");
      await db.exec(sql);
    }

    // Insert test restaurant and execute get_public_menu
    const restId = "55555555-5555-5555-5555-555555555555";
    await db.exec(`
      INSERT INTO public.restaurants (id, slug, name_en, name_ar, menu_status, status)
      VALUES ('${restId}', 'smoke-test-cafe', 'Smoke Test Cafe', 'كافيه تجريبي', 'PUBLISHED', 'ACTIVE');

      INSERT INTO public.restaurant_settings (restaurant_id) VALUES ('${restId}');
      INSERT INTO public.restaurant_branding (restaurant_id) VALUES ('${restId}');
      INSERT INTO public.categories (id, restaurant_id, name_en, name_ar, is_visible, sort_order)
      VALUES ('66666666-6666-6666-6666-666666666666', '${restId}', 'Beverages', 'مشروبات', true, 1);
    `);

    const res = await db.query<{ menu: { restaurant: { name_en: string; slug: string }; categories: unknown[] } }>(
      `SELECT public.get_public_menu('smoke-test-cafe') as menu;`,
    );

    expect(res.rows[0].menu).toBeDefined();
    expect(res.rows[0].menu.restaurant.name_en).toBe("Smoke Test Cafe");
    expect(res.rows[0].menu.restaurant.slug).toBe("smoke-test-cafe");
    expect(res.rows[0].menu.categories.length).toBe(1);
    } finally {
      await db.close();
    }
  }, 30000);
});

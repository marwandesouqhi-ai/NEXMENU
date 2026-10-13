import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

describe("PostgreSQL Profile Protection Trigger Regression Suite (008 vs 009)", { timeout: 30000 }, () => {
  let func008Sql: string;
  let func009Sql: string;

  const aliceId = "11111111-1111-1111-1111-111111111111";
  const bobId = "22222222-2222-2222-2222-222222222222";
  const adminId = "99999999-9999-9999-9999-999999999999";

  beforeEach(() => {
    // Extract REAL trigger function text directly from migration files
    const mig008 = fs.readFileSync(path.resolve("supabase/migrations/008_super_admin_bootstrap_and_menu_fix.sql"), "utf-8");
    const match008 = mig008.match(/create or replace function public\.protect_profile_sensitive_columns\(\)[\s\S]*?\$\$[\s]*;/i);
    if (!match008) throw new Error("Could not extract protect_profile_sensitive_columns from 008");
    func008Sql = match008[0];

    const mig009 = fs.readFileSync(path.resolve("supabase/migrations/009_profile_protection_security_definer_fix.sql"), "utf-8");
    const match009 = mig009.match(/create or replace function public\.protect_profile_sensitive_columns\(\)[\s\S]*?\$\$[\s]*;/i);
    if (!match009) throw new Error("Could not extract protect_profile_sensitive_columns from 009");
    func009Sql = match009[0];
  });

  async function createTestDb(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
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
      END
      $$;

      GRANT ALL ON SCHEMA public TO postgres, authenticated, anon;

      CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        name text NOT NULL,
        platform_role text NOT NULL DEFAULT 'USER',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND platform_role = 'SUPER_ADMIN'
        );
      $$;

      GRANT ALL ON public.profiles TO authenticated;
      GRANT ALL ON public.profiles TO anon;
    `);

    return db;
  }

  it("verifies security hole in migration 008: authenticated user CAN self-promote to SUPER_ADMIN", async () => {
    const db008 = await createTestDb();
    try {
      await db008.exec(`
        INSERT INTO public.profiles (id, email, name, platform_role) VALUES
          ('${aliceId}', 'alice@test.com', 'Alice', 'USER'),
          ('${adminId}', 'admin@test.com', 'Super Admin', 'SUPER_ADMIN');
      `);

      // Load broken 008 function
      await db008.exec(func008Sql);
      await db008.exec(`
        CREATE TRIGGER trg_protect_profile_sensitive_columns
          BEFORE UPDATE ON public.profiles
          FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();
      `);

      // Alice attempts to self-promote
      await db008.exec(`
        SET SESSION AUTHORIZATION authenticated;
        SET request.jwt.claim.sub = '${aliceId}';
        UPDATE public.profiles SET platform_role = 'SUPER_ADMIN' WHERE id = '${aliceId}';
      `);

      const res = await db008.query<{ platform_role: string }>(`SELECT platform_role FROM public.profiles WHERE id = '${aliceId}'`);
      // 008 allows self-promotion because current_user === 'postgres' inside SECURITY DEFINER
      expect(res.rows[0].platform_role).toBe("SUPER_ADMIN");
    } finally {
      await db008.close();
    }
  });

  describe("Migration 009 Security Invariants", () => {
    let db: PGlite;

    beforeAll(async () => {
      db = await createTestDb();
      await db.exec(func009Sql);
      await db.exec(`
        CREATE TRIGGER trg_protect_profile_sensitive_columns
          BEFORE UPDATE ON public.profiles
          FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();
      `);
    });

    afterAll(async () => {
      if (db) {
        await db.close();
      }
    });

    beforeEach(async () => {
      await db.exec(`
        SET SESSION AUTHORIZATION postgres;
        SET request.jwt.claim.sub = '';
        TRUNCATE public.profiles;
        INSERT INTO public.profiles (id, email, name, platform_role) VALUES
          ('${aliceId}', 'alice@test.com', 'Alice', 'USER'),
          ('${bobId}', 'bob@test.com', 'Bob', 'USER'),
          ('${adminId}', 'admin@test.com', 'Super Admin', 'SUPER_ADMIN');
      `);
    });

    it("(a) authenticated user cannot set own platform_role to SUPER_ADMIN", async () => {
      await db.exec(`
        SET SESSION AUTHORIZATION authenticated;
        SET request.jwt.claim.sub = '${aliceId}';
      `);

      await expect(
        db.exec(`UPDATE public.profiles SET platform_role = 'SUPER_ADMIN' WHERE id = '${aliceId}';`),
      ).rejects.toThrow(/Only super administrators can alter platform_role/);

      // Verify role remains unchanged
      const res = await db.query<{ platform_role: string }>(`SELECT platform_role FROM public.profiles WHERE id = '${aliceId}'`);
      expect(res.rows[0].platform_role).toBe("USER");
    });

    it("(b) authenticated user cannot change own id or email", async () => {
      await db.exec(`
        SET SESSION AUTHORIZATION authenticated;
        SET request.jwt.claim.sub = '${aliceId}';
      `);

      await expect(
        db.exec(`UPDATE public.profiles SET id = '33333333-3333-3333-3333-333333333333' WHERE id = '${aliceId}';`),
      ).rejects.toThrow(/Changing profile ID is not permitted/);

      await expect(
        db.exec(`UPDATE public.profiles SET email = 'hacked@test.com' WHERE id = '${aliceId}';`),
      ).rejects.toThrow(/Changing profile email directly is not permitted/);
    });

    it("(c) authenticated user can change own name", async () => {
      await db.exec(`
        SET SESSION AUTHORIZATION authenticated;
        SET request.jwt.claim.sub = '${aliceId}';
        UPDATE public.profiles SET name = 'Alice Renamed' WHERE id = '${aliceId}';
      `);

      const res = await db.query<{ name: string }>(`SELECT name FROM public.profiles WHERE id = '${aliceId}'`);
      expect(res.rows[0].name).toBe("Alice Renamed");
    });

    it("(d) privileged operator session with no JWT (SQL Editor / CLI) CAN set platform_role", async () => {
      // In an operator session: session_user is postgres, no request.jwt.claim.sub is set
      await db.exec(`
        SET SESSION AUTHORIZATION postgres;
        SET request.jwt.claim.sub = '';
        UPDATE public.profiles SET platform_role = 'SUPER_ADMIN' WHERE id = '${bobId}';
      `);

      const res = await db.query<{ platform_role: string }>(`SELECT platform_role FROM public.profiles WHERE id = '${bobId}'`);
      expect(res.rows[0].platform_role).toBe("SUPER_ADMIN");
    });

    it("(e) real super admin session can change another user's role", async () => {
      // Authenticated session as Super Admin
      await db.exec(`
        SET SESSION AUTHORIZATION authenticated;
        SET request.jwt.claim.sub = '${adminId}';
        UPDATE public.profiles SET platform_role = 'SUPER_ADMIN' WHERE id = '${aliceId}';
      `);

      const res = await db.query<{ platform_role: string }>(`SELECT platform_role FROM public.profiles WHERE id = '${aliceId}'`);
      expect(res.rows[0].platform_role).toBe("SUPER_ADMIN");
    });
  });
});

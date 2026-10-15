import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

describe("PostgreSQL Team Invitations & Membership Invariants (001-010)", { timeout: 35000 }, () => {
  let db: PGlite;

  const ownerAId = "11111111-1111-1111-1111-111111111111";
  const staffAId = "22222222-2222-2222-2222-222222222222";
  const ownerBId = "33333333-3333-3333-3333-333333333333";
  const existingUserId = "44444444-4444-4444-4444-444444444444";

  const restaurantAId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const restaurantBId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  beforeAll(async () => {
    db = new PGlite();

    // Setup Supabase auth and storage mock environment
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text,
        raw_user_meta_data jsonb DEFAULT '{}',
        email_confirmed_at timestamptz
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

      GRANT ALL ON SCHEMA auth TO postgres, authenticated, service_role, supabase_admin;
      GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, authenticated, service_role, supabase_admin;
      GRANT ALL ON SCHEMA public TO postgres, authenticated, anon;

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

    // Apply migrations 001 through 010 in order
    const migrationDir = path.resolve("supabase/migrations");
    const migrationFiles = fs.readdirSync(migrationDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    expect(migrationFiles.length).toBeGreaterThanOrEqual(10);

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(migrationDir, file), "utf-8");
      sql = sql.replace(/create extension if not exists pgcrypto;/gi, "-- pgcrypto built into PG");
      await db.exec(sql);
    }

    // Seed test accounts and restaurants
    await db.exec(`
      -- Users (trigger on_auth_user_created will insert into public.profiles automatically)
      INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
        ('${ownerAId}', 'ownera@tenant-a.com', now(), '{"name":"Owner Alice"}'),
        ('${staffAId}', 'staffa@tenant-a.com', now(), '{"name":"Staff Carol"}'),
        ('${ownerBId}', 'ownerb@tenant-b.com', now(), '{"name":"Owner Bob"}'),
        ('${existingUserId}', 'confirmed@tenant-a.com', now(), '{"name":"Confirmed User"}');

      -- Restaurants
      INSERT INTO public.restaurants (id, slug, name_en, name_ar, menu_status, status) VALUES
        ('${restaurantAId}', 'restaurant-a', 'Restaurant A', 'مطعم أ', 'PUBLISHED', 'ACTIVE'),
        ('${restaurantBId}', 'restaurant-b', 'Restaurant B', 'مطعم ب', 'PUBLISHED', 'ACTIVE');

      -- Memberships
      INSERT INTO public.restaurant_members (restaurant_id, profile_id, email, role, status) VALUES
        ('${restaurantAId}', '${ownerAId}', 'ownera@tenant-a.com', 'RESTAURANT_OWNER', 'ACTIVE'),
        ('${restaurantAId}', '${staffAId}', 'staffa@tenant-a.com', 'STAFF', 'ACTIVE'),
        ('${restaurantBId}', '${ownerBId}', 'ownerb@tenant-b.com', 'RESTAURANT_OWNER', 'ACTIVE');
    `);
  }, 35000);

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await db.exec(`
      SET SESSION AUTHORIZATION authenticated;
      SET request.jwt.claim.sub = '${userId}';
    `);
    try {
      return await fn();
    } finally {
      await db.exec(`
        RESET SESSION AUTHORIZATION;
        SET request.jwt.claim.sub = '';
      `);
    }
  }

  it("1. owner can invite a new team member", async () => {
    const res = await asUser(ownerAId, async () => {
      return db.query<{ id: string; status: string; role: string }>(`
        SELECT id, status, role FROM public.invite_member('${restaurantAId}', 'newstaff@tenant-a.com', 'STAFF');
      `);
    });

    expect(res.rows.length).toBe(1);
    expect(res.rows[0].role).toBe("STAFF");
    expect(res.rows[0].status).toBe("PENDING");
  });

  it("2. staff cannot invite a team member", async () => {
    await expect(
      asUser(staffAId, async () => {
        return db.query(`
          SELECT * FROM public.invite_member('${restaurantAId}', 'hacker@test.com', 'STAFF');
        `);
      }),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("3. owner of tenant A cannot invite into tenant B", async () => {
    await expect(
      asUser(ownerAId, async () => {
        return db.query(`
          SELECT * FROM public.invite_member('${restaurantBId}', 'spy@tenant-b.com', 'STAFF');
        `);
      }),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("4. invite for unknown email results in PENDING with NULL profile_id", async () => {
    const res = await asUser(ownerAId, async () => {
      return db.query<{ id: string; status: string; profile_id: string | null }>(`
        SELECT id, status, profile_id FROM public.invite_member('${restaurantAId}', 'unknown-invitee@external.com', 'STAFF');
      `);
    });

    expect(res.rows[0].status).toBe("PENDING");
    expect(res.rows[0].profile_id).toBeNull();
  });

  it("5. claim happens only after email confirmation", async () => {
    const testEmail = "future-signup@external.com";
    const futureUserId = "55555555-5555-5555-5555-555555555555";

    // Invite unknown email -> status PENDING
    await asUser(ownerAId, async () => {
      await db.query(`
        SELECT * FROM public.invite_member('${restaurantAId}', '${testEmail}', 'RESTAURANT_MANAGER');
      `);
    });

    // 6. Unconfirmed sign-up does NOT claim the membership
    await db.exec(`
      INSERT INTO auth.users (id, email, email_confirmed_at)
      VALUES ('${futureUserId}', '${testEmail}', NULL);
    `);

    let member = await asUser(ownerAId, async () => {
      return db.query<{ status: string; profile_id: string | null }>(`
        SELECT status, profile_id FROM public.restaurant_members
        WHERE restaurant_id = '${restaurantAId}' AND email = '${testEmail}';
      `);
    });
    expect(member.rows[0].status).toBe("PENDING");
    expect(member.rows[0].profile_id).toBeNull();

    // User confirms email -> triggers claim_pending_memberships
    await db.exec(`
      UPDATE auth.users
      SET email_confirmed_at = now()
      WHERE id = '${futureUserId}';
    `);

    member = await asUser(ownerAId, async () => {
      return db.query<{ status: string; profile_id: string | null }>(`
        SELECT status, profile_id FROM public.restaurant_members
        WHERE restaurant_id = '${restaurantAId}' AND email = '${testEmail}';
      `);
    });
    expect(member.rows[0].status).toBe("ACTIVE");
    expect(member.rows[0].profile_id).toBe(futureUserId);
  });

  it("7. duplicate invite for the same (restaurant_id, email) is rejected", async () => {
    await expect(
      asUser(ownerAId, async () => {
        return db.query(`
          SELECT * FROM public.invite_member('${restaurantAId}', 'newstaff@tenant-a.com', 'STAFF');
        `);
      }),
    ).rejects.toThrow(/already invited/i);
  });

  it("8. SUSPENDED status is allowed by constraint", async () => {
    const memRes = await asUser(ownerAId, async () => {
      return db.query<{ id: string }>(`
        SELECT id FROM public.restaurant_members
        WHERE restaurant_id = '${restaurantAId}' AND profile_id = '${staffAId}';
      `);
    });
    const memberId = memRes.rows[0].id;

    // Owner suspends staff member
    await asUser(ownerAId, async () => {
      await db.query(`
        UPDATE public.restaurant_members
        SET status = 'SUSPENDED'
        WHERE id = '${memberId}';
      `);
    });

    const check = await asUser(ownerAId, async () => {
      return db.query<{ status: string }>(`
        SELECT status FROM public.restaurant_members WHERE id = '${memberId}';
      `);
    });
    expect(check.rows[0].status).toBe("SUSPENDED");
  });

  it("9. last-owner invariant is still enforced against removal or suspension", async () => {
    const ownerRes = await asUser(ownerAId, async () => {
      return db.query<{ id: string }>(`
        SELECT id FROM public.restaurant_members
        WHERE restaurant_id = '${restaurantAId}' AND role = 'RESTAURANT_OWNER' AND status = 'ACTIVE';
      `);
    });
    expect(ownerRes.rows.length).toBe(1);
    const ownerMemberId = ownerRes.rows[0].id;

    // Attempt to suspend the only active owner
    await expect(
      asUser(ownerAId, async () => {
        return db.query(`
          UPDATE public.restaurant_members
          SET status = 'SUSPENDED'
          WHERE id = '${ownerMemberId}';
        `);
      }),
    ).rejects.toThrow(/Cannot remove, deactivate, or demote the last active owner/i);

    // Attempt to demote the only active owner
    await expect(
      asUser(ownerAId, async () => {
        return db.query(`
          UPDATE public.restaurant_members
          SET role = 'STAFF'
          WHERE id = '${ownerMemberId}';
        `);
      }),
    ).rejects.toThrow(/Cannot remove, deactivate, or demote the last active owner/i);

    // Attempt to delete the only active owner
    await expect(
      asUser(ownerAId, async () => {
        return db.query(`
          DELETE FROM public.restaurant_members
          WHERE id = '${ownerMemberId}';
        `);
      }),
    ).rejects.toThrow(/Cannot remove, deactivate, or demote the last active owner/i);
  });

  it("10. email enumeration is not leaked by return shape", async () => {
    // Call invite_member for an unknown email vs confirmed known user
    const resUnknown = await asUser(ownerAId, async () => {
      return db.query<Record<string, unknown>>(`
        SELECT * FROM public.invite_member('${restaurantAId}', 'anon-user-test-99@external.com', 'STAFF');
      `);
    });

    const resConfirmed = await asUser(ownerAId, async () => {
      return db.query<Record<string, unknown>>(`
        SELECT * FROM public.invite_member('${restaurantAId}', 'confirmed@tenant-a.com', 'STAFF');
      `);
    });

    const keysUnknown = Object.keys(resUnknown.rows[0] as object).sort();
    const keysConfirmed = Object.keys(resConfirmed.rows[0] as object).sort();

    // Exact same record fields returned regardless of whether the account already exists
    expect(keysUnknown).toEqual(keysConfirmed);
    expect(keysUnknown).toEqual([
      "created_at",
      "email",
      "id",
      "profile_id",
      "restaurant_id",
      "role",
      "status",
      "updated_at",
    ]);
  });
});

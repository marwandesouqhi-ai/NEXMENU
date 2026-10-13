# Blockers & Action Items Requiring User Input

This document tracks items that require external resources, real production credentials, or user actions.

| Item | Status | Action Required from User | Exact Command / Steps |
|---|---|---|---|
| Local PostgreSQL / Docker Engine for SQL Validation | WRITTEN, NOT RUN LOCALLY | Docker daemon is stopped and psql is not installed locally. | Start Docker Desktop and run: `docker run --name nexmenu-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:17`, then apply `supabase/complete_setup.sql`. |
| Remote Supabase Test Project for `pnpm test:rls` | PENDING / OPTIONAL | Provide a dedicated staging/test Supabase project (never use production). | Set `RLS_TEST_SUPABASE_URL` and `RLS_TEST_SUPABASE_ANON_KEY` in environment, then run `pnpm test:rls`. |

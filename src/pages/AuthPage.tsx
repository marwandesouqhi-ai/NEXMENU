import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Brand } from "@/components/shared/Brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/app/AuthContext";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { session, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(mode === "login" ? "owner@cafemoon.local" : "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(mode === "login" ? "Moon@1234" : "");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (session) return <Navigate to="/dashboard" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "login") await signIn(email, password); else await signUp(email, password, name);
      const next = (location.state as { from?: string } | null)?.from ?? (mode === "signup" ? "/onboarding" : "/dashboard");
      navigate(next, { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Authentication failed."); } finally { setBusy(false); }
  };
  return <main className="grid min-h-screen lg:grid-cols-[.9fr_1.1fr]">
    <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-16">
      <div className="flex items-center justify-between"><Brand /><Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="size-4 rtl:rotate-180" /> Home</Button></Link></div>
      <div className="mx-auto my-auto w-full max-w-md py-16">
        <p className="text-sm font-bold text-[var(--accent)]">{mode === "login" ? "WELCOME BACK" : "START YOUR MENU"}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">{mode === "login" ? "Sign in to NEXMENU" : "Create your workspace"}</h1>
        <p className="mt-3 text-[var(--ink-soft)]">{mode === "login" ? "Manage your menu, QR and restaurant presence." : "Start locally now. Your data stays in this browser."}</p>
        <form onSubmit={submit} className="mt-9 grid gap-5">
          {mode === "signup" && <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} required />}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="relative"><Input label="Password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute bottom-0 end-0 grid size-11 place-items-center text-[var(--ink-soft)]">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
          {error && <p role="alert" className="rounded-xl bg-[var(--danger-soft)] p-3 text-sm font-medium text-[var(--danger)]">{error}</p>}
          <Button type="submit" size="lg" loading={busy}>{mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
        {mode === "login" && <p className="mt-4 text-center"><Link className="text-sm font-bold text-[var(--accent)]" to="/reset-password">Forgot password?</Link></p>}
        <p className="mt-7 text-center text-sm text-[var(--ink-soft)]">{mode === "login" ? "New to NEXMENU?" : "Already have an account?"} <Link className="font-bold text-[var(--accent)]" to={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Create an account" : "Sign in"}</Link></p>
        {mode === "login" && <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--muted)] p-4 text-xs leading-6 text-[var(--ink-soft)]"><strong className="text-[var(--ink)]">Development accounts</strong><br />Owner: owner@cafemoon.local / Moon@1234<br />Admin: admin@nexmenu.local / Admin@1234</div>}
      </div>
    </section>
    <aside className="relative hidden overflow-hidden bg-[var(--ink)] p-16 text-white lg:flex lg:flex-col lg:justify-end"><div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,color-mix(in_srgb,var(--accent)_45%,transparent),transparent_45%)]" /><div className="relative max-w-xl"><ShieldCheck className="mb-8 size-10 text-[var(--accent-bright)]" /><p className="text-4xl font-black leading-tight tracking-[-.04em]">A professional menu is the shortest distance between your kitchen and your guests.</p><p className="mt-6 leading-7 text-white/60">Local mode stores data in this browser only. Export your workspace any time.</p></div></aside>
  </main>;
}

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { authService } from "@/services/auth";
import { Brand } from "@/components/shared/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function ResetPasswordPage() {
  const navigate = useNavigate(); const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [password, setPassword] = useState(""); const [issued, setIssued] = useState(""); const [error, setError] = useState("");
  const request = async (event: FormEvent) => { event.preventDefault(); setError(""); try { setIssued(await authService.requestReset(email)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create a reset code."); } };
  const reset = async (event: FormEvent) => { event.preventDefault(); setError(""); try { await authService.resetPassword(email, code, password); navigate("/login"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reset password."); } };
  return <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-5"><Card className="w-full max-w-md p-6 sm:p-8"><Brand /><p className="mt-8 text-xs font-bold text-[var(--accent)]">DEVELOPMENT MODE</p><h1 className="mt-2 text-3xl font-black">Reset local password</h1><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">No email is sent in local mode. A one-time code is displayed here.</p>{!issued ? <form onSubmit={(event) => void request(event)} className="mt-6 grid gap-4"><Input type="email" label="Account email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Button type="submit">Create development code</Button></form> : <form onSubmit={(event) => void reset(event)} className="mt-6 grid gap-4"><div className="rounded-xl bg-[var(--accent-soft)] p-4 text-center"><p className="text-xs font-bold text-[var(--accent-strong)]">ONE-TIME DEVELOPMENT CODE</p><p className="mt-1 text-2xl font-black tracking-[.2em]">{issued}</p></div><Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} required /><Input type="password" label="New password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /><Button type="submit">Reset password</Button></form>}{error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}<Link to="/login" className="mt-6 block text-center text-sm font-bold text-[var(--accent)]">Back to sign in</Link></Card></main>;
}

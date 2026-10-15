import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { authService } from "@/services/auth";
import { Brand } from "@/components/shared/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const isCloud = import.meta.env.VITE_DATA_ADAPTER === "supabase";

  // Local mode state
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [issued, setIssued] = useState("");

  // Cloud mode state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(() => {
    if (import.meta.env.VITE_DATA_ADAPTER !== "supabase") return false;
    if (typeof window === "undefined") return false;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hashParams.get("type") === "recovery";
  });
  const [linkError, setLinkError] = useState(() => {
    if (import.meta.env.VITE_DATA_ADAPTER !== "supabase") return "";
    if (typeof window === "undefined") return "";
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const urlError =
      hashParams.get("error_description") ||
      searchParams.get("error_description") ||
      hashParams.get("error") ||
      searchParams.get("error");
    return urlError
      ? "This password reset link is invalid or has expired. Please request a new link."
      : "";
  });
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Common state
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Detect recovery session or error in cloud mode
  useEffect(() => {
    if (!isCloud) return;

    const hashParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.hash.replace(/^#/, ""))
        : new URLSearchParams();
    const hashType = hashParams.get("type");
    const hasRecoveryHash = hashType === "recovery" || hashParams.has("access_token");

    const unsubscribe = authService.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        (event === "SIGNED_IN" && hasRecoveryHash) ||
        (session && hasRecoveryHash)
      ) {
        setIsRecovery(true);
        setLinkError("");
      }
    });

    void authService.session().then((sess) => {
      if (sess && hasRecoveryHash) {
        setIsRecovery(true);
        setLinkError("");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isCloud]);

  // Rate-limiting cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // --- Local Mode Handlers ---
  const requestLocal = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      setIssued(await authService.requestReset(email));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a reset code.");
    }
  };

  const resetLocal = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await authService.resetPassword(email, code, password);
      navigate("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset password.");
    }
  };

  // --- Cloud Mode Handlers ---
  const requestCloud = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const msg = await authService.requestReset(email);
      setInfo(msg || "If an account exists for this email, you will receive password reset instructions.");
      setCooldown(30);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request password reset.");
    } finally {
      setBusy(false);
    }
  };

  const submitNewPasswordCloud = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await authService.updatePassword(newPassword);
      await authService.signOut();
      navigate("/login", {
        state: { notice: "Password reset successfully. Please sign in with your new password." },
        replace: true,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  };

  // --- Render Local Mode UI ---
  if (!isCloud) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-5">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <Brand />
          <p className="mt-8 text-xs font-bold text-[var(--accent)]">DEVELOPMENT MODE</p>
          <h1 className="mt-2 text-3xl font-black">Reset local password</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            No email is sent in local mode. A one-time code is displayed here.
          </p>
          {!issued ? (
            <form onSubmit={(event) => void requestLocal(event)} className="mt-6 grid gap-4">
              <Input
                type="email"
                label="Account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit">Create development code</Button>
            </form>
          ) : (
            <form onSubmit={(event) => void resetLocal(event)} className="mt-6 grid gap-4">
              <div className="rounded-xl bg-[var(--accent-soft)] p-4 text-center">
                <p className="text-xs font-bold text-[var(--accent-strong)]">ONE-TIME DEVELOPMENT CODE</p>
                <p className="mt-1 text-2xl font-black tracking-[.2em]">{issued}</p>
              </div>
              <Input
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <Input
                type="password"
                label="New password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit">Reset password</Button>
            </form>
          )}
          {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
          <Link to="/login" className="mt-6 block text-center text-sm font-bold text-[var(--accent)]">
            Back to sign in
          </Link>
        </Card>
      </main>
    );
  }

  // --- Render Cloud Mode UI ---
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-5">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <Brand />

        {linkError ? (
          <div className="mt-8">
            <h1 className="text-2xl font-black">Reset link expired or invalid</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
              {linkError}
            </p>
            <div className="mt-6">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setLinkError("");
                  setIsRecovery(false);
                  setError("");
                  setInfo("");
                  if (typeof window !== "undefined" && window.location.hash) {
                    window.location.hash = "";
                  }
                }}
              >
                Request a new link
              </Button>
            </div>
          </div>
        ) : isRecovery ? (
          <div className="mt-8">
            <h1 className="text-2xl font-black">Set new password</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Enter and confirm your new password (minimum 8 characters).
            </p>
            <form onSubmit={(event) => void submitNewPasswordCloud(event)} className="mt-6 grid gap-4">
              <Input
                type="password"
                label="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
              <Input
                type="password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Re-enter your new password"
              />
              {error && <p role="alert" className="text-sm font-medium text-[var(--danger)]">{error}</p>}
              <Button type="submit" loading={busy} className="w-full">
                Update password
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-8">
            <h1 className="text-2xl font-black">Reset your password</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Enter your email address and we will send you a link to reset your password.
            </p>
            {info && (
              <div
                role="status"
                className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-400"
              >
                {info}
              </div>
            )}
            <form onSubmit={(event) => void requestCloud(event)} className="mt-6 grid gap-4">
              <Input
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
              />
              {error && <p role="alert" className="text-sm font-medium text-[var(--danger)]">{error}</p>}
              <Button
                type="submit"
                loading={busy}
                disabled={cooldown > 0}
                className="w-full"
              >
                {cooldown > 0 ? `Resend link (${cooldown}s)` : "Send reset link"}
              </Button>
            </form>
          </div>
        )}

        <Link to="/login" className="mt-6 block text-center text-sm font-bold text-[var(--accent)]">
          Back to sign in
        </Link>
      </Card>
    </main>
  );
}

import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { usePageMeta } from "@/components/PolinaLayout";
import { trpc } from "@/lib/trpc";

export function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const request = trpc.auth.requestPasswordReset.useMutation({ onSuccess: () => setSubmitted(true) });
  usePageMeta("Password recovery — POLINA", "Request a POLINA admin password reset.", true);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    request.mutate({ email });
  };

  return (
    <main className="auth-screen">
      <Link href="/admin/login" className="auth-back"><ArrowLeft size={15} /> Back to sign in</Link>
      <section className="auth-card">
        <span className="mono-label">POLINA / ACCOUNT RECOVERY</span>
        <h1><KeyRound size={25} aria-hidden="true" /> Reset password</h1>
        {submitted ? <div className="reset-confirmation"><CheckCircle2 size={22} /><p>If an admin account exists, reset instructions can be sent after POLINA's secure email service is configured.</p></div> : <>
          <p>Enter the administrator email. For account privacy, the confirmation is the same whether or not the address is registered.</p>
          <form onSubmit={submit} className="admin-form">
            <label>Email address<input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {request.error ? <p className="form-error" role="alert">Could not submit the request. Please try again later.</p> : null}
            <button className="button-red button-red--wide" type="submit" disabled={request.isPending}>{request.isPending ? "Sending…" : "Request reset link"}</button>
          </form>
        </>}
      </section>
    </main>
  );
}

export function PasswordResetFormPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const reset = trpc.auth.resetPassword.useMutation({ onSuccess: () => setLocation("/admin/login") });
  usePageMeta("Choose a new password — POLINA", "Set a new POLINA admin password.", true);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) return;
    reset.mutate({ token, password });
  };

  return (
    <main className="auth-screen">
      <Link href="/admin/login" className="auth-back"><ArrowLeft size={15} /> Back to sign in</Link>
      <section className="auth-card">
        <span className="mono-label">POLINA / NEW CREDENTIAL</span>
        <h1><KeyRound size={25} aria-hidden="true" /> Choose a password</h1>
        <p>Use 12–128 characters. Reset links can be used only once and expire.</p>
        <form onSubmit={submit} className="admin-form">
          <label>New password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {password && confirmation && password !== confirmation ? <p className="form-error" role="alert">Passwords do not match.</p> : null}
          {reset.error ? <p className="form-error" role="alert">{reset.error.message}</p> : null}
          {!token ? <p className="form-error" role="alert">This reset link is missing or invalid.</p> : null}
          <button className="button-red button-red--wide" type="submit" disabled={!token || reset.isPending || password !== confirmation}>{reset.isPending ? "Updating…" : "Set new password"}</button>
        </form>
      </section>
    </main>
  );
}

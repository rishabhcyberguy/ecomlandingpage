import { useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link, useLocation } from "wouter";
import { usePageMeta } from "@/components/PolinaLayout";
import { trpc } from "@/lib/trpc";

export function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.signIn.useMutation({ onSuccess: () => setLocation("/admin") });
  usePageMeta("Admin sign in — POLINA", "Sign in to manage POLINA content.", true);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <main className="auth-screen">
      <Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to POLINA</Link>
      <section className="auth-card">
        <span className="mono-label">POLINA / PRIVATE ACCESS</span>
        <h1><LockKeyhole size={25} aria-hidden="true" /> Admin sign in</h1>
        <p>Use your administrator email and password. Public account registration is disabled.</p>
        <form onSubmit={submit} className="admin-form">
          <label>Email address<input type="email" name="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required minLength={1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {login.error ? <p className="form-error" role="alert">{login.error.message}</p> : null}
          <button className="button-red button-red--wide" type="submit" disabled={login.isPending}>{login.isPending ? "Checking…" : "Sign in"}</button>
        </form>
        <Link className="auth-secondary-link" href="/admin/reset">Forgot password?</Link>
      </section>
    </main>
  );
}

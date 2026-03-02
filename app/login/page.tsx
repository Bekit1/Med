"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [ready, setReady] = useState(false);

  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const supabase = createClient();

  // Clear any stale/broken session on mount so the login page always works
  useEffect(() => {
    supabase.auth.signOut().finally(() => {
      setReady(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Неверный email или пароль"
            : authError.message
        );
        return;
      }

      // Hard redirect to ensure middleware sets fresh cookies
      window.location.href = next;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: email.split("@")[0] },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setError("");
      setMode("login");
      alert("Регистрация успешна! Проверьте почту для подтверждения.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white text-2xl font-bold">
          FH
        </div>
        <h1 className="text-2xl font-semibold">Family Health</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {mode === "login"
            ? "Войдите для доступа к медицинским данным семьи"
            : "Создайте аккаунт для вашей семьи"}
        </p>
      </div>

      <form
        onSubmit={mode === "login" ? handleLogin : handleRegister}
        className="space-y-4"
      >
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Пароль"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          required
        />

        <Button type="submit" loading={loading} className="w-full">
          {mode === "login" ? "Войти" : "Зарегистрироваться"}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Зарегистрироваться
            </button>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Войти
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={
        <div className="flex items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}

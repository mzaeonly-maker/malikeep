
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Your account has been created successfully.");
          router.replace("/");
          router.refresh();
        } else {
          setMessage(
            "Registration successful! Please check your email and click the verification link before logging in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;

        setMessage("Login successful. Welcome to MALIKEEP!");
        router.replace("/");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setMessage("");
    setError("");
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>M</div>
          <div>
            <h1 style={styles.brand}>MALIKEEP</h1>
            <p style={styles.tagline}>SMART BUSINESS MANAGEMENT</p>
          </div>
        </div>

        <div style={styles.heading}>
          <h2>
            {mode === "login"
              ? "Welcome back!"
              : "Create your account"}
          </h2>
          <p>
            {mode === "login"
              ? "Sign in to manage and grow your business."
              : "Get started with smarter business management."}
          </p>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => switchMode("login")}
            style={{
              ...styles.tab,
              ...(mode === "login" ? styles.activeTab : {})
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => switchMode("signup")}
            style={{
              ...styles.tab,
              ...(mode === "signup" ? styles.activeTab : {})
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="email" style={styles.label}>
            Email Address
          </label>

          <input
            id="email"
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            style={styles.input}
          />

          <label htmlFor="password" style={styles.label}>
            Password
          </label>

          <div style={styles.passwordWrapper}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              style={styles.passwordInput}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={styles.showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {mode === "signup" && (
            <p style={styles.hint}>
              Use at least 8 characters for your password.
            </p>
          )}

          {error && (
            <div role="alert" style={styles.error}>
              {error}
            </div>
          )}

          {message && (
            <div role="status" style={styles.success}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submit,
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create My Account"}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() =>
              switchMode(mode === "login" ? "signup" : "login")
            }
            style={styles.switchButton}
          >
            {mode === "login" ? "Register here" : "Sign in"}
          </button>
        </p>

        <div style={styles.footer}>
          <span>Secure business management</span>
          <span>© 2026 MALIKEEP</span>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px 16px",
    background: "#f1f5f2",
    fontFamily: "Arial, sans-serif"
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    background: "#ffffff",
    padding: "36px 30px",
    borderRadius: "18px",
    boxShadow: "0 12px 45px rgba(15, 55, 35, 0.09)"
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "35px"
  },
  logoIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#164a32",
    color: "#ffffff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "27px",
    fontWeight: 800
  },
  brand: {
    margin: 0,
    color: "#164a32",
    fontSize: "23px",
    fontWeight: 800,
    letterSpacing: "1px"
  },
  tagline: {
    margin: "4px 0 0",
    fontSize: "9px",
    color: "#748477",
    letterSpacing: "1.2px"
  },
  heading: {
    marginBottom: "25px"
  },
  headingTitle: {
    color: "#164a32"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "11px"
  },
  tabs: {
    display: "flex",
    background: "#f1f5f2",
    borderRadius: "10px",
    padding: "4px",
    marginBottom: "24px"
  },
  tab: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "12px 5px",
    borderRadius: "8px",
    color: "#68766c",
    fontWeight: 600,
    cursor: "pointer"
  },
  activeTab: {
    background: "#164a32",
    color: "#ffffff"
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#34483a",
    marginTop: "5px"
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px",
    border: "1px solid #dce5dd",
    borderRadius: "9px",
    fontSize: "14px",
    outlineColor: "#2e7d50"
  },
  passwordWrapper: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #dce5dd",
    borderRadius: "9px",
    overflow: "hidden"
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    padding: "14px",
    border: "none",
    outline: "none",
    fontSize: "14px"
  },
  showPassword: {
    border: "none",
    background: "#ffffff",
    padding: "12px",
    color: "#2e7d50",
    fontWeight: 700,
    cursor: "pointer"
  },
  hint: {
    margin: "0",
    fontSize: "12px",
    color: "#718074"
  },
  error: {
    background: "#fff0f0",
    color: "#b42318",
    border: "1px solid #f5caca",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.5
  },
  success: {
    background: "#edf8f0",
    color: "#17643a",
    border: "1px solid #c8e7d0",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.5
  },
  submit: {
    marginTop: "12px",
    padding: "15px",
    background: "#164a32",
    color: "#ffffff",
    border: "none",
    borderRadius: "9px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer"
  },
  switchText: {
    textAlign: "center",
    color: "#68766c",
    fontSize: "13px",
    marginTop: "25px"
  },
  switchButton: {
    border: "none",
    background: "transparent",
    color: "#237348",
    fontWeight: 700,
    cursor: "pointer"
  },
  footer: {
    borderTop: "1px solid #edf1ed",
    marginTop: "28px",
    paddingTop: "18px",
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
    color: "#89958b",
    fontSize: "10px"
  }
};


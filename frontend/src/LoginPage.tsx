import { useState, useEffect } from "react";
import { login as apiLogin, register as apiRegister } from "./api";

interface Props {
  onLogin: () => void;
}

type Mode = "login" | "register";

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isRegister = mode === "register";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  function validate() {
    const e: { email?: string; password?: string } = {};
    if (!email) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < (isRegister ? 8 : 6))
      e.password = `Minimum ${isRegister ? 8 : 6} characters`;
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setFormError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await apiRegister(email, password);
      }
      await apiLogin(email, password);
      setFading(true);
      await new Promise(r => setTimeout(r, 400));
      onLogin();
    } catch (err: any) {
      setFormError(parseAuthError(err?.message ?? "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  function clearErr(key: "email" | "password") {
    setErrors(p => { const n = { ...p }; delete n[key]; return n; });
    setFormError(null);
  }

  function toggleMode() {
    setMode(m => (m === "login" ? "register" : "login"));
    setErrors({});
    setFormError(null);
  }

  return (
    <div
      className={`min-h-screen flex transition-opacity duration-500 ${fading ? "opacity-0" : mounted ? "opacity-100" : "opacity-0"}`}
      style={{ background: "var(--bone)", color: "var(--ink)", fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..800,0..100,0..1;1,9..144,400..800,0..100,0..1&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

        :root {
          --bone: #efe9dd; --paper: #f7f1e3;
          --ink: #131310; --ink-soft: #3a3a36; --ink-muted: #7a756c;
          --rule: #ddd6c7; --rule-strong: #131310;
          --red: #c41e3a; --red-deep: #a01a30;
        }
        .display { font-family: 'Fraunces', serif; font-weight: 500; font-variation-settings: "WONK" 1, "SOFT" 30, "opsz" 144; }
        .field-wrap:focus-within { border-color: var(--ink); }
        .field-wrap.err:focus-within { border-color: var(--red); }
        @keyframes tickerScroll { from { transform: translateX(0);} to { transform: translateX(-50%);} }
        .ticker-track { animation: tickerScroll 60s linear infinite; }
        @keyframes livePulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }
        .live-dot { animation: livePulse 1.4s ease-in-out infinite; }
        @keyframes spin { to { transform: rotate(360deg); }}
        .spin { animation: spin 0.7s linear infinite; }
      `}</style>

      {/* ── LEFT — editorial brand panel ─────────────────────────── */}
      <aside className="hidden lg:flex lg:w-[50%] relative flex-col justify-between p-14 bg-[var(--ink)] text-[var(--bone)] overflow-hidden">

        {/* Top header */}
        <div className="relative z-10 flex items-center justify-between">
          <a href="/" className="flex items-baseline gap-1">
            <span className="display text-[1.5rem] leading-none tracking-tight text-[var(--bone)]">Revveal</span>
            <span className="w-[7px] h-[7px] bg-[var(--red)] inline-block translate-y-[-2px]" />
          </a>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">Buyer's Index</span>
        </div>

        {/* Center — editorial copy */}
        <div className="relative z-10 max-w-[24rem]">
          <div className="flex items-baseline gap-3 mb-12">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">§ Access</span>
            <span className="h-px w-14 bg-[var(--bone)]/40 translate-y-[-3px]" />
          </div>

          <h2 className="display text-[3.5rem] leading-[0.92] tracking-[-0.02em] mb-8">
            Sign in.<br />
            <span className="italic text-[var(--red)]">Stop guessing.</span>
          </h2>

          <p className="text-[15px] leading-[1.65] text-[var(--bone)]/70 max-w-[20rem]">
            Save searches. Set drop alerts. The next great deal will go in hours — Revveal puts you on it first.
          </p>
        </div>

        {/* Bottom — live ticker preview */}
        <div className="relative z-10 border-t border-[var(--bone)]/15 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">Live · Last 24h</span>
          </div>
          <div className="overflow-hidden">
            <div className="ticker-track flex gap-8 whitespace-nowrap font-mono text-[12px]">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-2 shrink-0 opacity-70">
                  <span className="opacity-50">{t.tag}</span>
                  <span>{t.label}</span>
                  <span className="text-[var(--red)] opacity-90">{t.delta}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </aside>

      {/* ── RIGHT — login form ────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-16 relative">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand */}
          <div className="lg:hidden mb-12 flex items-baseline gap-1">
            <span className="display text-[1.5rem] leading-none tracking-tight">Revveal</span>
            <span className="w-[7px] h-[7px] bg-[var(--red)] inline-block translate-y-[-2px]" />
          </div>

          <div className="flex items-baseline gap-3 mb-8">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-muted)]">
              § 01 — {isRegister ? "New buyer" : "Returning"}
            </span>
            <span className="h-px flex-1 bg-[var(--rule-strong)] translate-y-[-3px]" />
          </div>

          <h1 className="display text-[2.6rem] leading-[1] tracking-[-0.02em] mb-3">
            {isRegister ? (
              <>Create your <span className="italic">account</span>.</>
            ) : (
              <>Welcome <span className="italic">back</span>.</>
            )}
          </h1>
          <p className="text-[14px] text-[var(--ink-muted)] mb-10">
            {isRegister ? "Start tracking deals before they go." : "Continue to your deal feed."}
          </p>

          {/* Social row */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <SocialBtn icon={<GoogleIcon />} label="Google" />
            <SocialBtn icon={<GitHubIcon />} label="GitHub" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-[var(--rule)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">or with email</span>
            <div className="h-px flex-1 bg-[var(--rule)]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Field label="Email address" error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); clearErr("email"); }}
                placeholder="you@example.com"
                className="field-input"
              />
            </Field>

            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearErr("password"); }}
                  placeholder="••••••••"
                  className="field-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none" onClick={() => setRememberMe(v => !v)}>
                <span
                  className={`w-4 h-4 border-[1.5px] flex items-center justify-center transition-colors duration-150 ${rememberMe ? "bg-[var(--ink)] border-[var(--ink)]" : "bg-transparent border-[var(--ink-muted)]/60 group-hover:border-[var(--ink)]"}`}
                >
                  {rememberMe && (
                    <svg className="w-2.5 h-2.5 text-[var(--bone)]" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-[13px] text-[var(--ink-soft)] group-hover:text-[var(--ink)]">Remember me</span>
              </label>
              <button type="button" className="text-[13px] text-[var(--red)] hover:text-[var(--red-deep)] transition-colors">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-[var(--ink)] text-[var(--bone)] font-medium text-[15px] rounded-full hover:bg-[var(--red)] disabled:opacity-60 disabled:hover:bg-[var(--ink)] transition-all duration-200 group flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{isRegister ? "Creating account" : "Signing in"}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? "Create account" : "Sign in"}</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </>
              )}
            </button>

            {formError && (
              <p className="mt-3 text-[12px] text-[var(--red)] flex items-center gap-1.5">
                <span className="font-bold">!</span> {formError}
              </p>
            )}
          </form>

          <p className="mt-10 text-center text-[13px] text-[var(--ink-muted)]">
            {isRegister ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={toggleMode}
              className="text-[var(--ink)] underline underline-offset-4 decoration-[var(--red)] decoration-2 hover:decoration-[var(--ink)] transition-colors"
            >
              {isRegister ? "Sign in instead" : "Create an account"}
            </button>
          </p>
        </div>

        {/* Local field styles */}
        <style>{`
          .field-input {
            width: 100%;
            padding: 14px 16px;
            background: transparent;
            border: 1px solid var(--rule-strong);
            border-radius: 0;
            font-size: 15px;
            color: var(--ink);
            outline: none;
            transition: border-color 0.15s ease, background-color 0.15s ease;
            font-family: 'DM Sans', sans-serif;
          }
          .field-input::placeholder { color: var(--ink-muted); opacity: 0.6; }
          .field-input:focus { background: var(--paper); }
          .field-input.err { border-color: var(--red); }
        `}</style>
      </main>
    </div>
  );
}

function parseAuthError(raw: string): string {
  // Map common backend errors to friendlier copy.
  if (/409/.test(raw) || /already registered/i.test(raw)) return "That email is already registered.";
  if (/401/.test(raw) || /Invalid email or password/i.test(raw)) return "Invalid email or password.";
  if (/429/.test(raw)) return "Too many attempts — please try again in a minute.";
  // Pydantic validation errors come back as JSON arrays
  if (/value is not a valid email/i.test(raw)) return "Enter a valid email.";
  if (/string_too_short/i.test(raw)) return "Password must be at least 8 characters.";
  return raw.length > 120 ? "Something went wrong." : raw;
}

const TICKER = [
  { tag: "AUS/TX", label: "2019 CIVIC", delta: "↓20.5%" },
  { tag: "DAL/TX", label: "2020 RAV4", delta: "↓18.2%" },
  { tag: "PHX/AZ", label: "2018 CAMRY", delta: "↓24.1%" },
  { tag: "DEN/CO", label: "2021 CR-V", delta: "↓7.9%" },
  { tag: "ATL/GA", label: "2017 ALTIMA", delta: "↓31.4%" },
];

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)] mb-2.5 block">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-2 text-[12px] text-[var(--red)] flex items-center gap-1.5">
          <span className="font-bold">!</span> {error}
        </p>
      )}
    </div>
  );
}

function SocialBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-2.5 px-4 py-3 bg-transparent border border-[var(--rule-strong)] text-[14px] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bone)] transition-all duration-200"
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Eye() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

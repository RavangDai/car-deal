import { useState, useEffect } from "react";
import { useLoginMutation, useRegisterAndLoginMutation } from "./hooks";

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
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const loginMut = useLoginMutation();
  const registerMut = useRegisterAndLoginMutation();

  const isRegister = mode === "register";
  const loading = loginMut.isPending || registerMut.isPending;

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

    const mutation = isRegister ? registerMut : loginMut;
    try {
      await mutation.mutateAsync({ email, password });
      setFading(true);
      await new Promise(r => setTimeout(r, 400));
      onLogin();
    } catch (err: any) {
      setFormError(parseAuthError(err?.message ?? "Something went wrong."));
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
    >
      <style>{STYLES}</style>

      {/* ── LEFT — brand panel ──────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 overflow-hidden bg-[#0a1530] text-white">

        {/* Showroom photo backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center brand-photo"
          style={{ backgroundImage: "url('/assets/bg-showroom.png')" }}
        />
        {/* Layered gradient overlays for depth */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,21,48,0.65) 0%, rgba(10,21,48,0.85) 60%, rgba(10,21,48,0.95) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 18% 18%, rgba(31,95,255,0.28) 0%, transparent 60%)",
          }}
        />

        {/* Top — brand */}
        <div className="relative z-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <img
              src="/assets/revveal-icon.png"
              alt=""
              aria-hidden
              className="w-9 h-9 rounded-[9px] shadow-[0_8px_24px_rgba(31,95,255,0.45)] transition-transform duration-300 group-hover:rotate-[-4deg]"
            />
            <span className="display text-[1.5rem] leading-none tracking-[-0.02em] font-semibold">Revveal</span>
          </a>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">Buyer's Intelligence</span>
        </div>

        {/* Center — editorial copy */}
        <div className="relative z-20 max-w-[26rem]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm mb-10">
            <span className="rv-live-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">Live · Last 24h</span>
          </div>

          <h2 className="display text-[3.6rem] leading-[0.96] tracking-[-0.03em] mb-7 font-semibold">
            Sign in.<br />
            <span className="rv-accent italic">Stop guessing.</span>
          </h2>

          <p className="text-[15.5px] leading-[1.65] text-white/70 max-w-[22rem]">
            Save searches. Set drop alerts. The next great deal will go in hours — Revveal puts you on it first.
          </p>

          {/* Inline mini-stats */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-[24rem]">
            {STATS.map(s => (
              <div key={s.lbl} className="border-l border-white/15 pl-3.5">
                <div className="display text-[1.4rem] font-semibold leading-none">{s.val}</div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] opacity-55 mt-2">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — live ticker */}
        <div className="relative z-20 border-t border-white/10 pt-6">
          <div className="overflow-hidden">
            <div className="ticker-track flex gap-8 whitespace-nowrap font-mono text-[12px]">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-2 shrink-0 opacity-75">
                  <span className="opacity-50">{t.tag}</span>
                  <span>{t.label}</span>
                  <span className="text-[#7da8ff]">{t.delta}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Soft grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] pointer-events-none z-[1]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </aside>

      {/* ── RIGHT — form ──────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-14 relative bg-[var(--paper)]">

        {/* Atmospheric blobs */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 90% 0%, rgba(31,95,255,0.06) 0%, transparent 60%), radial-gradient(40% 30% at 0% 100%, rgba(31,95,255,0.05) 0%, transparent 60%)",
          }}
        />

        <div className="w-full max-w-[420px] relative">

          {/* Mobile brand */}
          <div className="lg:hidden mb-12 flex items-center gap-3">
            <img
              src="/assets/revveal-icon.png"
              alt=""
              aria-hidden
              className="w-9 h-9 rounded-[9px] shadow-[0_4px_14px_rgba(31,95,255,0.22)]"
            />
            <span className="display text-[1.5rem] leading-none tracking-[-0.02em] font-semibold">Revveal</span>
          </div>

          {/* Pill kicker */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--blue-tint)] border border-[var(--blue)]/15 mb-7">
            <span className="rv-live-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--blue-deep)]">
              {isRegister ? "New buyer" : "Welcome back"}
            </span>
          </div>

          <h1 className="display text-[2.6rem] leading-[1] tracking-[-0.03em] mb-3 font-semibold">
            {isRegister ? (
              <>Create your <span className="text-[var(--blue)] italic">account</span>.</>
            ) : (
              <>Welcome <span className="text-[var(--blue)] italic">back</span>.</>
            )}
          </h1>
          <p className="text-[14.5px] text-[var(--ink-muted)] mb-9">
            {isRegister ? "Start tracking deals before they go." : "Continue to your deal feed."}
          </p>

          {/* Social row */}
          <div className="grid grid-cols-2 gap-3 mb-7">
            <SocialBtn icon={<GoogleIcon />} label="Google" />
            <SocialBtn icon={<GitHubIcon />} label="GitHub" />
          </div>

          <div className="flex items-center gap-3 mb-7">
            <div className="h-px flex-1 bg-[var(--rule)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">or with email</span>
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
                className={`field-input ${errors.email ? "err" : ""}`}
              />
            </Field>

            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearErr("password"); }}
                  placeholder="••••••••"
                  className={`field-input pr-12 ${errors.password ? "err" : ""}`}
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
                  className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors duration-150 ${rememberMe ? "bg-[var(--blue)] border-[var(--blue)]" : "bg-transparent border-[var(--rule-strong)] group-hover:border-[var(--ink)]"}`}
                >
                  {rememberMe && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-[13px] text-[var(--ink-soft)] group-hover:text-[var(--ink)]">Remember me</span>
              </label>
              <button type="button" className="text-[13px] text-[var(--blue)] hover:text-[var(--blue-deep)] transition-colors font-medium">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rv-submit"
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </>
              )}
            </button>

            {formError && (
              <p className="mt-2 text-[12.5px] text-[#dc2626] flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#fee2e2] text-[#dc2626] font-bold text-[10px]">!</span>
                {formError}
              </p>
            )}
          </form>

          <p className="mt-9 text-center text-[13px] text-[var(--ink-muted)]">
            {isRegister ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={toggleMode}
              className="text-[var(--ink)] font-semibold underline underline-offset-4 decoration-[var(--blue)] decoration-2 hover:decoration-[var(--ink)] transition-colors"
            >
              {isRegister ? "Sign in instead" : "Create an account"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function parseAuthError(raw: string): string {
  if (/409/.test(raw) || /already registered/i.test(raw)) return "That email is already registered.";
  if (/401/.test(raw) || /Invalid email or password/i.test(raw)) return "Invalid email or password.";
  if (/429/.test(raw)) return "Too many attempts — please try again in a minute.";
  if (/value is not a valid email/i.test(raw)) return "Enter a valid email.";
  if (/string_too_short/i.test(raw)) return "Password must be at least 8 characters.";
  return raw.length > 120 ? "Something went wrong." : raw;
}

const TICKER = [
  { tag: "AUS/TX", label: "2019 CIVIC", delta: "−20.5%" },
  { tag: "DAL/TX", label: "2020 RAV4", delta: "−18.2%" },
  { tag: "PHX/AZ", label: "2018 CAMRY", delta: "−24.1%" },
  { tag: "DEN/CO", label: "2021 CR-V", delta: "−7.9%" },
  { tag: "ATL/GA", label: "2017 ALTIMA", delta: "−31.4%" },
];

const STATS = [
  { val: "12.4k", lbl: "listings · today" },
  { val: "$3.2k", lbl: "avg. savings" },
  { val: "94%", lbl: "model accuracy" },
];

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[var(--ink-soft)] mb-2 block">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-2 text-[12px] text-[#dc2626] flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#fee2e2] text-[#dc2626] font-bold text-[10px]">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

function SocialBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white border border-[var(--rule-strong)] rounded-[12px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--blue)] hover:bg-[var(--blue-tint)] hover:text-[var(--blue-deep)] transition-all duration-200"
    >
      {icon}
      <span>{label}</span>
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

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  :root {
    --paper: #ffffff;
    --blue-tint: #ebf1ff;
    --ink: #0a1530;
    --ink-soft: #475574;
    --ink-muted: #8392ad;
    --rule: #e3e9f3;
    --rule-strong: #cfd8e6;
    --blue: #1f5fff;
    --blue-deep: #1648c4;
  }

  body { font-family: 'Geist', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

  .display {
    font-family: 'Bricolage Grotesque', serif;
    font-variation-settings: "wdth" 100, "opsz" 96;
    font-weight: 600;
  }

  .rv-accent { color: #4d7fff; }

  .field-input {
    width: 100%;
    padding: 14px 16px;
    background: white;
    border: 1px solid var(--rule-strong);
    border-radius: 12px;
    font-size: 15px;
    color: var(--ink);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
    font-family: 'Geist', sans-serif;
  }
  .field-input::placeholder { color: var(--ink-muted); opacity: 0.7; }
  .field-input:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 4px rgba(31,95,255,0.10);
  }
  .field-input.err {
    border-color: #ef4444;
    box-shadow: 0 0 0 4px rgba(239,68,68,0.08);
  }

  .rv-submit {
    width: 100%;
    margin-top: 6px;
    padding: 14px 24px;
    background: var(--blue);
    color: white;
    font-weight: 500;
    font-size: 15px;
    border-radius: 999px;
    transition: all 0.2s ease;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 6px 18px rgba(31,95,255,0.32), inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .rv-submit:hover:not(:disabled) {
    background: var(--blue-deep);
    box-shadow: 0 10px 26px rgba(31,95,255,0.42), inset 0 1px 0 rgba(255,255,255,0.18);
    transform: translateY(-1px);
  }
  .rv-submit:disabled { opacity: 0.65; cursor: wait; }

  .rv-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #4d7fff;
    animation: liveBeat 1.6s ease-in-out infinite;
    display: inline-block;
  }
  @keyframes liveBeat {
    0%, 100% { box-shadow: 0 0 0 0 rgba(77,127,255,0.6); }
    50% { box-shadow: 0 0 0 5px rgba(77,127,255,0); }
  }

  @keyframes tickerScroll { from { transform: translateX(0);} to { transform: translateX(-50%);} }
  .ticker-track { animation: tickerScroll 55s linear infinite; }

  @keyframes spin { to { transform: rotate(360deg); }}
  .spin { animation: spin 0.7s linear infinite; }

  @keyframes brandDrift {
    0%   { transform: scale(1.08) translate(0, 0); }
    50%  { transform: scale(1.14) translate(-1.5%, -1%); }
    100% { transform: scale(1.08) translate(0, 0); }
  }
  .brand-photo {
    filter: saturate(0.85) contrast(1.05);
    animation: brandDrift 28s ease-in-out infinite;
    will-change: transform;
  }
`;

import { useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useLoginMutation, useRegisterAndLoginMutation } from "./hooks";

interface Props {
  onLogin: () => void;
  onGuest: () => void;
}

type Mode = "login" | "register";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const sideContainer: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.15, staggerChildren: 0.07 } },
};
const sideItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE_OUT_EXPO } },
};
const formContainer: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.28, staggerChildren: 0.06 } },
};
const formItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
};

export default function LoginPage({ onLogin, onGuest }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  const loginMut = useLoginMutation();
  const registerMut = useRegisterAndLoginMutation();

  const isRegister = mode === "register";
  const loading = loginMut.isPending || registerMut.isPending;

  // The route-level AnimatePresence crossfade (App.tsx) owns the exit animation,
  // so this just hands control back to the parent.
  function exitThen(cb: () => void) {
    cb();
  }

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
      exitThen(onLogin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setFormError(parseAuthError(message));
    }
  }

  function clearErr(key: "email" | "password") {
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
    setFormError(null);
  }

  function toggleMode() {
    setMode((m) => (m === "login" ? "register" : "login"));
    setErrors({});
    setFormError(null);
  }

  const initial = prefersReduced ? "show" : "hidden";

  return (
    <motion.div className="rv-login min-h-screen flex">
      <style>{STYLES}</style>
      <PaperGrain />

      {/* ── LEFT — editorial sidebar ─────────────────────────── */}
      <motion.aside
        className="rv-login-side"
        variants={sideContainer}
        initial={initial}
        animate="show"
      >
        <motion.header className="rv-login-side-header" variants={sideItem}>
          <Wordmark />
        </motion.header>

        <div className="rv-login-side-body">
          <motion.div className="rv-login-side-eyebrow" variants={sideItem}>
            <span className="rv-login-side-dot" />
            <span>Updated 4 min ago · 12,408 listings today</span>
          </motion.div>

          <motion.h2 className="rv-display rv-login-side-title" variants={sideItem}>
            {isRegister ? (
              <>
                Find <em className="rv-emph">underpriced</em><br />
                cars before<br />
                anyone else.
              </>
            ) : (
              <>
                Welcome <em className="rv-emph">back</em>.<br />
                Your deals are<br />
                waiting.
              </>
            )}
          </motion.h2>

          <motion.p className="rv-login-side-sub" variants={sideItem}>
            {isRegister
              ? "Save searches, set drop alerts, and move on a great deal in hours — not days. Free for buyers — start in under a minute."
              : "Pick up where you left off — saved searches, drop alerts, and today's freshest deals across every major marketplace."}
          </motion.p>
        </div>

        <motion.div className="rv-login-side-foot" variants={sideItem}>
          <div className="rv-login-side-foot-k">Most undervalued · last 24 hours</div>
          <ul className="rv-login-side-deals">
            {RECENT_DEALS.map((d) => (
              <li key={d.label} className="rv-login-side-deal">
                <span className="rv-login-side-deal-title">{d.label}</span>
                <span className="rv-login-side-deal-loc">{d.loc}</span>
                <span className="rv-login-side-deal-delta">{d.delta}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </motion.aside>

      {/* ── RIGHT — form ─────────────────────────────────────── */}
      <main className="rv-login-main">
        <motion.div
          className="rv-login-main-inner"
          variants={formContainer}
          initial={initial}
          animate="show"
        >
          <motion.a href="/" className="rv-login-back" variants={formItem}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back to home</span>
          </motion.a>

          <motion.div className="lg:hidden mb-7" variants={formItem}>
            <Wordmark />
          </motion.div>

          <motion.h1 className="rv-display rv-login-title" variants={formItem}>
            {isRegister ? "Create your account." : "Sign in."}
          </motion.h1>
          <motion.p className="rv-login-sub" variants={formItem}>
            {isRegister
              ? "Takes under a minute. Free for buyers."
              : "Continue to your saved searches and alerts."}
          </motion.p>

          <motion.div className="rv-login-social" variants={formItem}>
            <SocialBtn icon={<GoogleIcon />} label="Continue with Google" />
            <SocialBtn icon={<GitHubIcon />} label="Continue with GitHub" />
          </motion.div>

          <motion.div className="rv-login-or" variants={formItem}>
            <span>or use email</span>
          </motion.div>

          <form onSubmit={handleSubmit} noValidate className="rv-login-form">
            <motion.div variants={formItem}>
              <Field label="Email" error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearErr("email"); }}
                  placeholder="you@example.com"
                  className={`rv-input ${errors.email ? "rv-input-err" : ""}`}
                  autoComplete="email"
                />
              </Field>
            </motion.div>

            <motion.div variants={formItem}>
              <Field label="Password" error={errors.password}>
                <div className="rv-password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearErr("password"); }}
                    placeholder={isRegister ? "At least 8 characters" : "Your password"}
                    className={`rv-input rv-input-pw ${errors.password ? "rv-input-err" : ""}`}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    className="rv-password-eye"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </Field>
            </motion.div>

            <motion.div className="rv-login-row" variants={formItem}>
              <label
                className="rv-checkbox"
                onClick={(e) => { e.preventDefault(); setRememberMe((v) => !v); }}
              >
                <span className={`rv-checkbox-box ${rememberMe ? "rv-checkbox-box-on" : ""}`}>
                  {rememberMe && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>Remember me</span>
              </label>
              {!isRegister && (
                <button type="button" className="rv-login-forgot">Forgot password?</button>
              )}
            </motion.div>

            <motion.div variants={formItem}>
              <button
                type="submit"
                disabled={loading}
                className="rv-login-submit"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 rv-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>{isRegister ? "Creating account" : "Signing in"}</span>
                  </>
                ) : (
                  <>
                    <span>{isRegister ? "Create account" : "Sign in"}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </motion.div>

            {formError && (
              <motion.p
                className="rv-login-form-err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="rv-login-form-err-mark">!</span>
                {formError}
              </motion.p>
            )}
          </form>

          <motion.div className="rv-login-guest" variants={formItem}>
            <span className="rv-login-guest-rule" />
            <button
              type="button"
              onClick={() => exitThen(onGuest)}
              className="rv-guest-btn"
            >
              <span className="rv-guest-btn-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
                </svg>
              </span>
              <span>Continue as guest</span>
              <svg className="rv-guest-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
            <span className="rv-login-guest-hint">Just looking? Browse today&apos;s deals — no account needed.</span>
          </motion.div>

          <motion.p className="rv-login-toggle" variants={formItem}>
            {isRegister ? "Already a member? " : "New here? "}
            <button type="button" onClick={toggleMode} className="rv-login-toggle-btn">
              {isRegister ? "Sign in instead" : "Create an account"}
            </button>
          </motion.p>

          <motion.p className="rv-login-fine" variants={formItem}>
            By {isRegister ? "creating an account" : "signing in"} you agree to our <a href="#/terms">Terms</a> and <a href="#/privacy">Privacy Policy</a>.
          </motion.p>
        </motion.div>
      </main>
    </motion.div>
  );
}

/* ── HELPERS ──────────────────────────────────────────────── */

function parseAuthError(raw: string): string {
  if (/409/.test(raw) || /already registered/i.test(raw)) return "That email is already registered.";
  if (/401/.test(raw) || /Invalid email or password/i.test(raw)) return "Invalid email or password.";
  if (/429/.test(raw)) return "Too many attempts — try again in a minute.";
  if (/value is not a valid email/i.test(raw)) return "Enter a valid email.";
  if (/string_too_short/i.test(raw)) return "Password must be at least 8 characters.";
  return raw.length > 120 ? "Something went wrong." : raw;
}

function Wordmark() {
  return (
    <a href="/" className="rv-wordmark">
      <span className="rv-wordmark-mark">
        <img src="/revveal-logo.png" alt="Revveal" className="rv-wordmark-img" />
      </span>
      <span className="rv-wordmark-name">Revveal</span>
    </a>
  );
}

function PaperGrain() {
  return (
    <svg className="rv-grain" aria-hidden>
      <filter id="rv-login-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 0 0.03  0 0 0 0.5 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#rv-login-grain)" />
    </svg>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="rv-field">
      <label className="rv-field-label">{label}</label>
      {children}
      {error && (
        <p className="rv-field-err">
          <span className="rv-field-err-mark">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

function SocialBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="rv-social-btn">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Eye() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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

/* ── DATA ─────────────────────────────────────────────────── */

const RECENT_DEALS = [
  { label: "2018 Toyota Camry SE", loc: "Phoenix, AZ", delta: "−24.1%" },
  { label: "2017 Nissan Altima",   loc: "Atlanta, GA", delta: "−31.4%" },
  { label: "2019 Honda Civic EX",  loc: "Austin, TX",  delta: "−20.5%" },
];

/* ── STYLES ───────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..900,0..100,0..1;1,9..144,300..900,0..100,0..1&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  .rv-login {
    --paper:        #ece2cd;
    --paper-deep:   #ddd0b4;
    --paper-soft:   #f3eada;
    --paper-pale:   #f7f0df;
    --ink:          #18130a;
    --ink-soft:     #2a2418;
    --ink-muted:    #6f6244;
    --ink-fade:     #968866;
    --red:          #b8312e;
    --red-deep:     #8a1d1c;
    --brass:        #a3792c;
    --err:          #b8312e;

    background: var(--paper);
    color: var(--ink);
    font-family: 'Newsreader', Georgia, serif;
    font-feature-settings: "ss01", "ss02", "liga";
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    position: relative;
    overflow: hidden;
  }

  .rv-login .rv-display {
    font-family: 'Fraunces', 'Times New Roman', serif;
    font-variation-settings: "opsz" 144, "SOFT" 50, "WONK" 0;
    font-weight: 600;
    letter-spacing: -0.018em;
  }

  .rv-login .rv-emph {
    font-style: italic;
    color: var(--red);
    font-variation-settings: "opsz" 144, "SOFT" 100, "WONK" 1;
  }

  /* Paper grain */
  .rv-login .rv-grain {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 50;
    opacity: 0.28;
    mix-blend-mode: multiply;
  }

  /* ── WORDMARK ─────────────────────────────────────── */
  .rv-login .rv-wordmark {
    display: inline-flex; align-items: center; gap: 10px;
    color: var(--ink); text-decoration: none;
  }
  .rv-login .rv-wordmark-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px;
  }
  .rv-login .rv-wordmark-img {
    width: 100%; height: 100%;
    object-fit: contain;
    display: block;
  }
  .rv-login .rv-wordmark-name {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 144, "SOFT" 30;
    font-weight: 700;
    font-size: 21px;
    letter-spacing: -0.02em;
    color: var(--ink);
    line-height: 1;
  }

  /* ── SIDE (LEFT) ───────────────────────────────────── */
  .rv-login .rv-login-side {
    display: none;
    position: relative;
    width: 54%;
    background: var(--ink);
    color: var(--paper-pale);
    padding: 44px 56px 36px;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    border-right: 1px solid var(--ink);
    isolation: isolate;
  }
  @media (min-width: 1024px) {
    .rv-login .rv-login-side { display: flex; }
  }
  .rv-login .rv-login-side .rv-wordmark { color: var(--paper-pale); }
  .rv-login .rv-login-side .rv-wordmark-name { color: var(--paper-pale); }

  .rv-login .rv-login-side-header,
  .rv-login .rv-login-side-body,
  .rv-login .rv-login-side-foot {
    position: relative;
    z-index: 2;
  }

  .rv-login .rv-login-side-body {
    max-width: 28rem;
  }
  .rv-login .rv-login-side-eyebrow {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--paper-deep);
    color: var(--paper-pale);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.12em;
    font-weight: 600;
    margin-bottom: 28px;
    opacity: 0.85;
  }
  .rv-login .rv-login-side-dot {
    width: 6px; height: 6px;
    background: var(--red);
    border-radius: 50%;
    animation: rv-login-pulse 2s ease-in-out infinite;
  }
  @keyframes rv-login-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .rv-login .rv-login-side-title {
    font-size: clamp(2.8rem, 5.5vw, 4.4rem);
    line-height: 0.96;
    letter-spacing: -0.025em;
    color: var(--paper-pale);
    margin: 0 0 22px;
    font-weight: 600;
    max-width: 16ch;
  }
  .rv-login .rv-login-side-sub {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: 16px;
    line-height: 1.55;
    color: var(--paper-deep);
    margin: 0;
    max-width: 36ch;
  }

  /* Recent deals strip — bottom of left side */
  .rv-login .rv-login-side-foot {
    padding-top: 22px;
    border-top: 1px solid rgba(245, 235, 210, 0.20);
  }
  .rv-login .rv-login-side-foot-k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-fade);
    margin-bottom: 14px;
    font-weight: 600;
  }
  .rv-login .rv-login-side-deals {
    list-style: none;
    padding: 0; margin: 0;
    display: flex; flex-direction: column;
    gap: 8px;
  }
  .rv-login .rv-login-side-deal {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 18px;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 1px dashed rgba(245, 235, 210, 0.18);
  }
  .rv-login .rv-login-side-deal:last-child { border-bottom: none; }
  .rv-login .rv-login-side-deal-title {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 18, "SOFT" 30;
    font-weight: 500;
    font-size: 15px;
    color: var(--paper-pale);
    letter-spacing: -0.005em;
  }
  .rv-login .rv-login-side-deal-loc {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    color: var(--ink-fade);
    letter-spacing: 0.06em;
  }
  .rv-login .rv-login-side-deal-delta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    color: var(--red);
    font-variant-numeric: tabular-nums;
    min-width: 56px;
    text-align: right;
  }

  /* ── MAIN (RIGHT) ─────────────────────────────────── */
  .rv-login .rv-login-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 36px 22px 28px;
    background: var(--paper);
    position: relative;
  }
  .rv-login .rv-login-main-inner {
    width: 100%;
    max-width: 420px;
    position: relative;
  }

  .rv-login .rv-login-back {
    display: inline-flex; align-items: center; gap: 7px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--ink-muted);
    text-decoration: none;
    margin-bottom: 36px;
    transition: color 0.2s ease;
  }
  .rv-login .rv-login-back:hover { color: var(--red); }
  .rv-login .rv-login-back svg { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  .rv-login .rv-login-back:hover svg { transform: translateX(-3px); }

  .rv-login .rv-login-title {
    font-size: clamp(2.2rem, 4.2vw, 2.8rem);
    line-height: 1;
    letter-spacing: -0.025em;
    color: var(--ink);
    font-weight: 600;
    margin: 0 0 10px;
  }
  .rv-login .rv-login-sub {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: 15.5px;
    line-height: 1.5;
    color: var(--ink-muted);
    margin: 0 0 28px;
  }

  /* Social buttons */
  .rv-login .rv-login-social {
    display: flex; flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
  }
  .rv-login .rv-social-btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    background: var(--paper-pale);
    border: 1px solid var(--ink);
    color: var(--ink);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    line-height: 1;
    cursor: pointer;
    border-radius: 0;
    transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  .rv-login .rv-social-btn:hover {
    background: var(--paper);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .rv-login .rv-social-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 var(--ink);
  }

  /* Divider */
  .rv-login .rv-login-or {
    display: flex; align-items: center; gap: 14px;
    margin: 24px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-fade);
    font-weight: 600;
  }
  .rv-login .rv-login-or::before,
  .rv-login .rv-login-or::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--ink-fade);
    opacity: 0.5;
  }

  /* Form */
  .rv-login .rv-login-form {
    display: flex; flex-direction: column;
    gap: 18px;
  }
  .rv-login .rv-field { display: flex; flex-direction: column; gap: 6px; }
  .rv-login .rv-field-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-muted);
    font-weight: 600;
  }
  .rv-login .rv-input {
    width: 100%;
    padding: 13px 14px;
    background: var(--paper-pale);
    border: 1px solid var(--ink);
    color: var(--ink);
    font-family: 'Newsreader', serif;
    font-size: 15.5px;
    line-height: 1.2;
    border-radius: 0;
    outline: none;
    transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }
  .rv-login .rv-input::placeholder { color: var(--ink-fade); }
  .rv-login .rv-input:focus {
    background: #ffffff;
    box-shadow: 3px 3px 0 var(--red);
    transform: translate(-1px, -1px);
  }
  .rv-login .rv-input-err {
    border-color: var(--err);
    background: rgba(184, 49, 46, 0.05);
  }
  .rv-login .rv-input-err:focus { box-shadow: 3px 3px 0 var(--err); }

  .rv-login .rv-input-pw { padding-right: 44px; }
  .rv-login .rv-password-wrap { position: relative; }
  .rv-login .rv-password-eye {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    transition: color 0.2s ease;
  }
  .rv-login .rv-password-eye:hover { color: var(--ink); }

  .rv-login .rv-field-err {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 13px;
    color: var(--err);
    margin: 4px 0 0;
  }
  .rv-login .rv-field-err-mark {
    width: 14px; height: 14px;
    background: var(--err);
    color: var(--paper-pale);
    display: inline-flex; align-items: center; justify-content: center;
    font-style: normal;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }

  .rv-login .rv-login-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
    padding-top: 2px;
  }
  .rv-login .rv-checkbox {
    display: inline-flex; align-items: center; gap: 9px;
    cursor: pointer;
    user-select: none;
    font-family: 'Newsreader', serif;
    font-size: 14px;
    color: var(--ink-soft);
  }
  .rv-login .rv-checkbox-box {
    width: 16px; height: 16px;
    border: 1.5px solid var(--ink);
    background: var(--paper-pale);
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--paper-pale);
    transition: background 0.15s ease;
  }
  .rv-login .rv-checkbox-box-on { background: var(--ink); }
  .rv-login .rv-login-forgot {
    background: transparent; border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink);
    font-weight: 600;
    cursor: pointer;
    padding: 4px 0;
    border-bottom: 1px solid var(--ink);
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .rv-login .rv-login-forgot:hover { color: var(--red); border-color: var(--red); }

  /* Submit — matching homepage primary button */
  .rv-login .rv-login-submit {
    width: 100%;
    margin-top: 6px;
    padding: 14px 22px;
    background: var(--red);
    color: var(--paper-pale);
    border: 1px solid var(--red);
    border-radius: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 3px 3px 0 var(--ink);
    transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  .rv-login .rv-login-submit:hover:not(:disabled) {
    background: var(--ink);
    border-color: var(--ink);
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--red);
  }
  .rv-login .rv-login-submit:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--red);
  }
  .rv-login .rv-login-submit:disabled { opacity: 0.7; cursor: wait; }

  .rv-login .rv-spin { animation: rv-spin 0.7s linear infinite; width: 14px; height: 14px; }
  @keyframes rv-spin { to { transform: rotate(360deg); } }

  .rv-login .rv-login-form-err {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 13.5px;
    color: var(--err);
    margin: 6px 0 0;
    padding: 10px 12px;
    background: rgba(184, 49, 46, 0.06);
    border-left: 2px solid var(--err);
  }
  .rv-login .rv-login-form-err-mark {
    width: 16px; height: 16px;
    background: var(--err);
    color: var(--paper-pale);
    display: inline-flex; align-items: center; justify-content: center;
    font-style: normal;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    flex-shrink: 0;
  }

  /* Guest path — tertiary, lighter than submit/social but same letterpress hover */
  .rv-login .rv-login-guest {
    display: flex; flex-direction: column; align-items: stretch;
    gap: 12px;
    margin-top: 22px;
  }
  .rv-login .rv-login-guest-rule {
    height: 1px;
    background: var(--ink-fade);
    opacity: 0.4;
    margin-bottom: 4px;
  }
  .rv-login .rv-guest-btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 13px 18px;
    background: transparent;
    border: 1px dashed var(--ink);
    color: var(--ink);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    line-height: 1;
    cursor: pointer;
    border-radius: 0;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease, color 0.2s ease;
  }
  .rv-login .rv-guest-btn:hover {
    background: var(--paper-pale);
    border-color: var(--ink);
    border-style: solid;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .rv-login .rv-guest-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 var(--ink);
  }
  .rv-login .rv-guest-btn-icon { display: inline-flex; align-items: center; color: var(--ink-muted); transition: color 0.2s ease; }
  .rv-login .rv-guest-btn:hover .rv-guest-btn-icon { color: var(--red); }
  .rv-login .rv-guest-btn-arrow { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  .rv-login .rv-guest-btn:hover .rv-guest-btn-arrow { transform: translateX(3px); }
  .rv-login .rv-login-guest-hint {
    text-align: center;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 12.5px;
    color: var(--ink-fade);
    line-height: 1.5;
  }

  /* Toggle (login ↔ register) */
  .rv-login .rv-login-toggle {
    text-align: center;
    margin: 28px 0 10px;
    font-family: 'Newsreader', serif;
    font-size: 14px;
    color: var(--ink-muted);
  }
  .rv-login .rv-login-toggle-btn {
    background: transparent; border: none;
    color: var(--ink);
    font-family: 'Newsreader', serif;
    font-size: 14px;
    font-weight: 600;
    font-style: italic;
    cursor: pointer;
    padding: 0;
    border-bottom: 1px solid var(--red);
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .rv-login .rv-login-toggle-btn:hover {
    color: var(--red);
  }

  .rv-login .rv-login-fine {
    text-align: center;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 12.5px;
    color: var(--ink-fade);
    margin: 0;
    max-width: 36ch;
    margin-left: auto; margin-right: auto;
    line-height: 1.5;
  }
  .rv-login .rv-login-fine a {
    color: var(--ink);
    text-decoration: underline;
    text-decoration-color: var(--red);
    text-underline-offset: 3px;
  }
  .rv-login .rv-login-fine a:hover { color: var(--red); }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .rv-login .rv-login-side-dot { animation: none; }
  }

  /* Responsive */
  @media (max-width: 1023px) {
    .rv-login .rv-login-main { padding: 32px 20px; }
  }
  @media (max-width: 480px) {
    .rv-login .rv-login-main { padding: 24px 18px; }
    .rv-login .rv-login-back { margin-bottom: 24px; }
    .rv-login .rv-login-title { font-size: 2rem; }
  }
`;

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { oauthLogin } from "./api";
import { useLoginMutation, useRegisterAndLoginMutation } from "./hooks";
import { Spinner } from "./Spinner";
import { CarImage } from "./CarImage";
import { IMAGES } from "./images";
import { FONT_IMPORT, THEME_TOKENS } from "./theme";

interface Props {
  onLogin: () => void;
  onGuest: () => void;
}

type Mode = "login" | "register";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const formContainer: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.05, staggerChildren: 0.05 } },
};
const formItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT_EXPO } },
};

export default function LoginPage({ onLogin, onGuest }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // An OAuth failure bounces back as "/?auth_error=<code>" — surface it from
  // the initial render rather than a setState-in-effect.
  const [formError, setFormError] = useState<{ text: string; tone: "err" | "notice" } | null>(() => {
    const code = new URLSearchParams(window.location.search).get("auth_error");
    return code ? parseOAuthError(code) : null;
  });
  const prefersReduced = useReducedMotion();

  const loginMut = useLoginMutation();
  const registerMut = useRegisterAndLoginMutation();

  // Strip the auth_error param so a refresh doesn't re-show the notice.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("auth_error")) return;
    params.delete("auth_error");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
  }, []);

  const isRegister = mode === "register";
  const loading = loginMut.isPending || registerMut.isPending;

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
      onLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setFormError({ text: parseAuthError(message), tone: "err" });
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
    <div className="rv-login min-h-screen flex">
      <style>{STYLES}</style>

      {/* ── LEFT — brand panel (full-bleed photography) ──────── */}
      <aside className="rv-login-side">
        <div className="rv-login-side-media" aria-hidden>
          <CarImage image={IMAGES.loginFeature} className="rv-login-side-img" position="center 42%" eager />
          <div className="rv-login-side-scrim" />
        </div>

        <header className="rv-login-side-z">
          <Wordmark />
        </header>

        <div className="rv-login-side-body rv-login-side-z">
          <p className="rv-eyebrow">Buyer-first car index</p>
          <h2 className="display rv-login-side-title">
            {isRegister ? (
              <>Find <em className="rv-emph">underpriced</em> cars before anyone else.</>
            ) : (
              <>Welcome <em className="rv-emph">back</em>. Your deals are waiting.</>
            )}
          </h2>
          <p className="rv-login-side-sub">
            {isRegister
              ? "Save searches, set drop alerts, and move on a great deal in hours — not days."
              : "Pick up where you left off — saved searches, alerts, and today's freshest deals."}
          </p>
        </div>

        <div className="rv-login-side-foot rv-login-side-z">
          <p className="rv-eyebrow mb-3">Most undervalued · last 24 hours</p>
          <ul className="rv-login-side-deals">
            {RECENT_DEALS.map((d) => (
              <li key={d.label} className="rv-login-side-deal">
                <span className="rv-login-side-deal-title">{d.label}</span>
                <span className="rv-login-side-deal-loc">{d.loc}</span>
                <span className="rv-login-side-deal-delta">{d.delta}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

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

          <motion.h1 className="display rv-login-title" variants={formItem}>
            {isRegister ? "Create your account." : "Sign in."}
          </motion.h1>
          <motion.p className="rv-login-sub" variants={formItem}>
            {isRegister
              ? "Takes under a minute. Free for buyers."
              : "Continue to your saved searches and alerts."}
          </motion.p>

          <motion.div className="rv-login-social" variants={formItem}>
            <SocialBtn icon={<GoogleIcon />} label="Continue with Google" onClick={() => oauthLogin("google")} />
            <SocialBtn icon={<GitHubIcon />} label="Continue with GitHub" onClick={() => oauthLogin("github")} />
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
              <button type="submit" disabled={loading} className="rv-login-submit">
                {loading ? (
                  <>
                    <Spinner size={15} className="text-current" />
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
                className={`rv-login-form-err${formError.tone === "notice" ? " rv-login-form-err--notice" : ""}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="rv-login-form-err-mark">!</span>
                {formError.text}
              </motion.p>
            )}
          </form>

          <motion.div className="rv-login-guest" variants={formItem}>
            <span className="rv-login-guest-rule" />
            <button type="button" onClick={onGuest} className="rv-guest-btn">
              <span>Continue as guest</span>
              <svg className="rv-guest-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
            <span className="rv-login-guest-hint">Just looking? Browse today's deals — no account needed.</span>
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
    </div>
  );
}

/* ── HELPERS ──────────────────────────────────────────────── */

function parseOAuthError(code: string): { text: string; tone: "err" | "notice" } {
  // "notice" = guidance the user can act on (amber); "err" = a real failure (red).
  switch (code) {
    case "email_unverified":
      return { text: "An account with that email already exists. Sign in with your password to link it.", tone: "notice" };
    case "already_linked":
      return { text: "That email is already linked to a different sign-in method.", tone: "notice" };
    case "no_email":
      return { text: "Your provider account didn't share a usable email address.", tone: "err" };
    default:
      return { text: "Social sign-in failed. Please try again.", tone: "err" };
  }
}

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
      <img src="/revveal-logo.png" alt="" aria-hidden className="rv-wordmark-img" />
      <span className="rv-wordmark-name">Revveal</span>
    </a>
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

function SocialBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="rv-social-btn" onClick={onClick}>
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
  ${FONT_IMPORT}

  .rv-login {
    ${THEME_TOKENS}
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .rv-login .display { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; line-height: 1.06; text-wrap: balance; font-optical-sizing: auto; }
  .rv-login .rv-emph { color: var(--red); }
  .rv-login .rv-eyebrow { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-muted); }

  .rv-login .rv-wordmark { display: inline-flex; align-items: center; gap: 9px; }
  .rv-login .rv-wordmark-img { width: 28px; height: 28px; object-fit: contain; }
  .rv-login .rv-wordmark-name { font-weight: 800; font-size: 20px; letter-spacing: -0.02em; }

  /* Left brand panel — full-bleed photography with overlaid copy. */
  .rv-login .rv-login-side {
    display: none;
    position: relative; isolation: isolate; overflow: hidden;
    width: 44%; max-width: 560px;
    padding: 44px;
    flex-direction: column; justify-content: space-between; gap: 40px;
    background: var(--ink);
    color: #fff;
  }
  @media (min-width: 1024px) { .rv-login .rv-login-side { display: flex; } }
  .rv-login .rv-login-side-media { position: absolute; inset: 0; z-index: -1; }
  .rv-login .rv-login-side-img { width: 100%; height: 100%; box-shadow: none; }
  .rv-login .rv-login-side-scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(180deg, rgba(14,14,16,.52) 0%, rgba(14,14,16,.34) 36%, rgba(14,14,16,.84) 100%),
      linear-gradient(90deg, rgba(14,14,16,.34), rgba(14,14,16,0) 58%);
  }
  .rv-login .rv-login-side-z { position: relative; z-index: 1; }
  .rv-login .rv-login-side .rv-wordmark-name { color: #fff; }
  .rv-login .rv-login-side .rv-eyebrow { color: rgba(255,255,255,.72); }
  .rv-login .rv-login-side .rv-emph { color: #ff6f63; }
  .rv-login .rv-login-side-title { font-size: clamp(2rem, 3vw, 2.8rem); line-height: 1.05; margin-top: 18px; color: #fff; text-shadow: 0 1px 18px rgba(0,0,0,.28); }
  .rv-login .rv-login-side-sub { margin-top: 18px; font-size: 16px; line-height: 1.55; color: rgba(255,255,255,.82); max-width: 40ch; }
  .rv-login .rv-login-side-deals { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .rv-login .rv-login-side-deal { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: baseline; padding: 11px 0; border-top: 1px solid rgba(255,255,255,.16); font-size: 13.5px; }
  .rv-login .rv-login-side-deal-title { font-weight: 600; color: rgba(255,255,255,.95); }
  .rv-login .rv-login-side-deal-loc { color: rgba(255,255,255,.6); font-size: 12.5px; }
  .rv-login .rv-login-side-deal-delta { font-weight: 700; color: #5fd6a6; font-variant-numeric: tabular-nums; }

  /* Right form */
  .rv-login .rv-login-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
  .rv-login .rv-login-main-inner { width: 100%; max-width: 400px; }
  .rv-login .rv-login-back { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--ink-muted); margin-bottom: 28px; transition: color .15s ease; }
  .rv-login .rv-login-back:hover { color: var(--ink); }
  .rv-login .rv-login-title { font-size: clamp(1.8rem, 4vw, 2.3rem); line-height: 1.05; }
  .rv-login .rv-login-sub { margin-top: 8px; font-size: 15px; color: var(--ink-muted); }

  .rv-login .rv-login-social { margin-top: 26px; display: flex; flex-direction: column; gap: 10px; }
  .rv-login .rv-social-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 11px 16px; border: 1px solid var(--rule-strong); border-radius: 10px; background: var(--paper-pale); font-family: 'Manrope', sans-serif; font-size: 14px; font-weight: 600; color: var(--ink); transition: border-color .15s ease, background-color .15s ease; }
  .rv-login .rv-social-btn:hover { border-color: var(--ink); background: var(--paper-soft); }

  .rv-login .rv-login-or { display: flex; align-items: center; gap: 14px; margin: 22px 0; color: var(--ink-fade); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
  .rv-login .rv-login-or::before, .rv-login .rv-login-or::after { content: ""; flex: 1; height: 1px; background: var(--rule); }

  .rv-login .rv-login-form { display: flex; flex-direction: column; gap: 16px; }
  .rv-login .rv-field { display: flex; flex-direction: column; gap: 6px; }
  .rv-login .rv-field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); }
  .rv-login .rv-input { width: 100%; background: var(--paper-pale); border: 1px solid var(--rule-strong); border-radius: 10px; font-family: 'Manrope', sans-serif; font-size: 15px; color: var(--ink); padding: 11px 13px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
  .rv-login .rv-input:focus { border-color: var(--red); box-shadow: 0 0 0 3px var(--red-tint); }
  .rv-login .rv-input::placeholder { color: var(--ink-fade); }
  .rv-login .rv-input-err { border-color: var(--red); }
  .rv-login .rv-password-wrap { position: relative; }
  .rv-login .rv-input-pw { padding-right: 44px; }
  .rv-login .rv-password-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); padding: 6px; color: var(--ink-fade); border-radius: 6px; transition: color .15s ease; }
  .rv-login .rv-password-eye:hover { color: var(--ink); }
  .rv-login .rv-field-err { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--err); }
  .rv-login .rv-field-err-mark, .rv-login .rv-login-form-err-mark { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: var(--red); color: #fff; font-size: 10px; font-weight: 700; flex-shrink: 0; }

  .rv-login .rv-login-row { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
  .rv-login .rv-checkbox { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--ink-muted); cursor: pointer; }
  .rv-login .rv-checkbox-box { width: 17px; height: 17px; border: 1px solid var(--rule-strong); border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; color: #fff; transition: background-color .15s ease, border-color .15s ease; }
  .rv-login .rv-checkbox-box-on { background: var(--red); border-color: var(--red); }
  .rv-login .rv-login-forgot { font-size: 13.5px; font-weight: 600; color: var(--link); transition: color .15s ease; }
  .rv-login .rv-login-forgot:hover { color: var(--link-hover); }

  .rv-login .rv-login-submit { display: inline-flex; align-items: center; justify-content: center; gap: 9px; width: 100%; padding: 12px 18px; margin-top: 4px; background: var(--red); color: #fff; font-family: 'Manrope', sans-serif; font-size: 15px; font-weight: 700; border-radius: 10px; box-shadow: 0 1px 2px rgba(138,29,28,.22); transition: background-color .18s ease, box-shadow .25s var(--ease-out-expo); }
  .rv-login .rv-login-submit:hover:not(:disabled) { background: var(--red-deep); box-shadow: 0 4px 16px rgba(184,49,46,.28); }
  .rv-login .rv-login-submit:disabled { opacity: 0.65; cursor: wait; }

  .rv-login .rv-login-form-err { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--err); }
  .rv-login .rv-login-form-err--notice { color: var(--amber-deep); }
  .rv-login .rv-login-form-err--notice .rv-login-form-err-mark { background: var(--amber); }

  .rv-login .rv-login-guest { margin-top: 22px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .rv-login .rv-login-guest-rule { width: 100%; height: 1px; background: var(--rule); }
  .rv-login .rv-guest-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: 1px solid var(--rule-strong); border-radius: 10px; font-family: 'Manrope', sans-serif; font-size: 14px; font-weight: 600; color: var(--ink); transition: border-color .15s ease; }
  .rv-login .rv-guest-btn:hover { border-color: var(--ink); }
  .rv-login .rv-guest-btn-arrow { transition: transform .25s cubic-bezier(.16,1,.3,1); }
  .rv-login .rv-guest-btn:hover .rv-guest-btn-arrow { transform: translateX(3px); }
  .rv-login .rv-login-guest-hint { font-size: 12.5px; color: var(--ink-fade); text-align: center; }

  .rv-login .rv-login-toggle { margin-top: 24px; text-align: center; font-size: 14px; color: var(--ink-muted); }
  .rv-login .rv-login-toggle-btn { font-weight: 700; color: var(--link); transition: color .15s ease; }
  .rv-login .rv-login-toggle-btn:hover { color: var(--link-hover); }
  .rv-login .rv-login-fine { margin-top: 18px; text-align: center; font-size: 12px; color: var(--ink-fade); line-height: 1.5; }
  .rv-login .rv-login-fine a { color: var(--link); text-decoration: underline; text-underline-offset: 2px; }
`;

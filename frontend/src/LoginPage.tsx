import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { oauthLogin } from "./api";
import { useLoginMutation, useRegisterAndLoginMutation } from "./hooks";
import { Spinner } from "./Spinner";
import { Arrow, Button, TopBar, Wordmark } from "./primitives";
import PasswordStrength from "./PasswordStrength";
import { MIN_STRENGTH_SCORE, passwordScore } from "./passwordRules";

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
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (!email) e.email = "Enter your email address";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "That doesn't look like an email address";
    if (!password) e.password = "Enter your password";
    else if (password.length < (isRegister ? 8 : 6))
      e.password = `Use at least ${isRegister ? 8 : 6} characters`;
    else if (isRegister && passwordScore(password) < MIN_STRENGTH_SCORE)
      e.password = "Add a mix of cases, numbers or symbols";
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
    <div className="rv-login rv-page min-h-screen">
      <style>{STYLES}</style>
      <TopBar
        links={[{ href: "#", label: "Today's deals" }]}
        activeHref="#"
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <div className="rv-login-split">
        {/* ── LEFT — the argument, made with the product's own mark ── */}
        <aside className="rv-login-side">
          <PriceLineBackdrop />

          <div className="rv-login-side-body">
            <p className="rv-eyebrow rv-login-side-eyebrow">Real price history, for everything</p>
            <h2 className="rv-display rv-login-side-title">
              {isRegister ? "Never overpay on a fake discount again." : "Your alerts are still watching."}
            </h2>
            <p className="rv-login-side-sub">
              {isRegister
                ? "Paste any product link. We record its price every day and score every drop against its own history."
                : "Pick up where you left off — tracked products, alert rules, and today's real deals."}
            </p>
          </div>

          <ul className="rv-login-side-list">
            {WHY_SIGN_UP.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
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
              <ArrowLeft size={14} />
              <span>Back to home</span>
            </motion.a>

            <motion.div className="rv-login-mobile-mark" variants={formItem}>
              <Wordmark size={22} />
            </motion.div>

            <motion.h1 className="rv-login-title" variants={formItem}>
              {isRegister ? "Create your account" : "Sign in"}
            </motion.h1>
            <motion.p className="rv-login-sub" variants={formItem}>
              {isRegister
                ? "Takes under a minute, and it's free to track."
                : "Continue to your tracked products and alerts."}
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
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {isRegister && <PasswordStrength password={password} />}
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
                <Button type="submit" variant="primary" size="lg" disabled={loading} className="rv-login-submit">
                  {loading ? (
                    <>
                      <Spinner size={15} className="text-current" />
                      <span>{isRegister ? "Creating account" : "Signing in"}</span>
                    </>
                  ) : (
                    <>
                      <span>{isRegister ? "Create account" : "Sign in"}</span>
                      <Arrow size={14} />
                    </>
                  )}
                </Button>
              </motion.div>

              {formError && (
                <motion.p
                  className={`rv-login-form-err${formError.tone === "notice" ? " rv-login-form-err--notice" : ""}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                >
                  {formError.text}
                </motion.p>
              )}
            </form>

            <motion.div className="rv-login-guest" variants={formItem}>
              <Button type="button" onClick={onGuest} variant="ghost">
                <span>Browse without an account</span>
                <Arrow size={14} />
              </Button>
              <span className="rv-login-guest-hint">Just looking? Today&rsquo;s deals are open to everyone.</span>
            </motion.div>

            <motion.p className="rv-login-toggle" variants={formItem}>
              {isRegister ? "Already a member? " : "New here? "}
              <button type="button" onClick={toggleMode} className="rv-login-toggle-btn">
                {isRegister ? "Sign in instead" : "Create an account"}
              </button>
            </motion.p>

            <motion.p className="rv-login-fine" variants={formItem}>
              By {isRegister ? "creating an account" : "signing in"} you agree to our{" "}
              <a href="#/terms" className="rv-link">Terms</a> and{" "}
              <a href="#/privacy" className="rv-link">Privacy Policy</a>.
            </motion.p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/* ── HELPERS ──────────────────────────────────────────────── */

// The brand panel's backdrop is the product's own subject: a step-after
// price line falling across the panel, drawn once on mount. Not a texture
// or a stock photograph — the same geometry every chart in the app uses.
function PriceLineBackdrop() {
  return (
    <svg
      className="rv-login-backdrop"
      viewBox="0 0 600 900"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M-20 210 H80 V300 H150 V265 H240 V420 H310 V395 H400 V560 H480 V530 H620"
        fill="none" stroke="rgba(244,243,239,.16)" strokeWidth="2"
      />
      <path
        d="M-20 350 H60 V430 H170 V400 H250 V590 H340 V560 H430 V700 H520 V680 H620"
        fill="none" stroke="rgba(244,243,239,.10)" strokeWidth="2"
      />
      <line x1="-20" y1="530" x2="620" y2="530" stroke="rgba(10,138,79,.55)" strokeWidth="1.5" strokeDasharray="7 6" />
    </svg>
  );
}

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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="rv-field">
      <label className="rv-field-label rv-eyebrow">{label}</label>
      {children}
      {error && <p className="rv-field-err">{error}</p>}
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

const WHY_SIGN_UP = [
  "Prices rechecked every day, automatically",
  "Ninety days of real history, charted",
  "An email the moment it's genuinely cheaper",
];

/* ── STYLES ───────────────────────────────────────────────── */

const STYLES = `
  .rv-login { background: var(--paper); color: var(--ink); font-family: var(--font-sans); }
  .rv-login-split {
    display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    min-height: calc(100vh - 56px);
  }

  /* ── Brand panel ── */
  .rv-login-side {
    position: relative; overflow: hidden; background: var(--ink); color: var(--paper);
    padding: 56px 48px; display: flex; flex-direction: column; justify-content: space-between; gap: 48px;
  }
  .rv-login-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; }
  .rv-login-side-body, .rv-login-side-list { position: relative; z-index: 1; }
  .rv-login-side-eyebrow { color: rgba(244,243,239,.62); }
  .rv-login-side-title {
    margin: 22px 0 0; font-size: clamp(30px, 3.6vw, 46px); color: var(--paper); max-width: 16ch;
  }
  .rv-login-side-sub {
    margin: 20px 0 0; font-size: 15.5px; line-height: 1.6; color: rgba(244,243,239,.72); max-width: 40ch;
  }
  .rv-login-side-list { list-style: none; margin: 0; padding: 0; }
  .rv-login-side-list li {
    padding: 14px 0 14px 24px; border-top: 1px solid rgba(244,243,239,.16);
    font-size: 14.5px; color: rgba(244,243,239,.86); position: relative;
  }
  .rv-login-side-list li::before {
    content: ""; position: absolute; left: 0; top: 22px; width: 12px; height: 2px; background: var(--green);
  }

  /* ── Form side ── */
  .rv-login-main { display: flex; align-items: center; justify-content: center; padding: 48px 24px 72px; }
  .rv-login-main-inner { width: 100%; max-width: 420px; }
  .rv-login-back {
    display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 500;
    color: var(--ink-muted); text-decoration: none; margin-bottom: 28px;
    transition: color var(--dur-fast) ease;
  }
  .rv-login-back:hover { color: var(--ink); }
  .rv-login-mobile-mark { display: none; margin-bottom: 26px; }

  .rv-login-title { margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; }
  .rv-login-sub { margin: 10px 0 0; font-size: 14.5px; color: var(--ink-muted); }

  .rv-login-social { display: flex; flex-direction: column; gap: 10px; margin-top: 28px; }
  .rv-social-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;
    padding: 12px 16px; font-family: var(--font-sans); font-size: 14.5px; font-weight: 600;
    color: var(--ink); background: var(--paper-pale); border: 1px solid var(--rule-strong);
    border-radius: var(--r-md); cursor: pointer;
    transition: border-color var(--dur-fast) ease, background-color var(--dur-fast) ease;
  }
  .rv-social-btn:hover { border-color: var(--ink); background: var(--paper-deep); }

  .rv-login-or {
    display: flex; align-items: center; gap: 14px; margin: 26px 0;
    font-family: var(--font-mono); font-size: 11px; text-transform: uppercase;
    letter-spacing: .14em; color: var(--ink-fade);
  }
  .rv-login-or::before, .rv-login-or::after {
    content: ""; flex: 1; height: 1px; background: var(--rule-strong);
  }

  .rv-login-form { display: flex; flex-direction: column; gap: 18px; }
  .rv-field { display: flex; flex-direction: column; gap: 7px; }
  .rv-field-label { color: var(--ink); }
  .rv-field-err { margin: 0; font-size: 12.5px; color: var(--red-deep); }
  .rv-input-err { border-color: var(--red); }
  .rv-input-err:focus { border-color: var(--red); box-shadow: inset 0 0 0 1px var(--red); }

  .rv-password-wrap { position: relative; }
  .rv-input-pw { padding-right: 44px; }
  .rv-password-eye {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    color: var(--ink-fade); background: none; cursor: pointer; padding: 4px;
    transition: color var(--dur-fast) ease;
  }
  .rv-password-eye:hover { color: var(--ink); }

  .rv-login-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .rv-checkbox { display: inline-flex; align-items: center; gap: 9px; font-size: 13.5px; cursor: pointer; user-select: none; }
  .rv-checkbox-box {
    display: grid; place-items: center; width: 17px; height: 17px; flex: none;
    border: 1px solid var(--rule-strong); background: var(--paper-pale); border-radius: var(--r-sm);
    color: var(--paper); transition: background-color var(--dur-fast) ease, border-color var(--dur-fast) ease;
  }
  .rv-checkbox-box-on { background: var(--ink); border-color: var(--ink); }
  .rv-login-forgot {
    font-size: 13px; font-weight: 500; color: var(--ink-muted); background: none; cursor: pointer;
    text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--rule-strong);
  }
  .rv-login-forgot:hover { color: var(--ink); }

  .rv-login-submit { width: 100%; margin-top: 4px; }

  .rv-login-form-err {
    margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--red-deep);
    background: var(--red-tint); padding: 11px 13px; border-left: 2px solid var(--red);
  }
  .rv-login-form-err--notice {
    color: var(--amber-deep); background: var(--amber-tint); border-left-color: var(--amber);
  }

  .rv-login-guest {
    display: flex; flex-direction: column; align-items: stretch; gap: 10px;
    margin-top: 26px; padding-top: 26px; border-top: 1px solid var(--rule);
  }
  .rv-login-guest-hint { font-size: 12.5px; color: var(--ink-muted); text-align: center; }

  .rv-login-toggle { margin: 24px 0 0; font-size: 14px; color: var(--ink-muted); text-align: center; }
  .rv-login-toggle-btn {
    font-size: 14px; font-weight: 600; color: var(--ink); background: none; cursor: pointer;
    text-decoration: underline; text-underline-offset: 3px;
  }
  .rv-login-fine { margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: var(--ink-fade); text-align: center; }

  @media (max-width: 960px) {
    .rv-login-split { grid-template-columns: 1fr; min-height: 0; }
    .rv-login-side { display: none; }
    .rv-login-mobile-mark { display: block; }
    .rv-login-main { padding: 36px 20px 64px; align-items: flex-start; }
  }
`;

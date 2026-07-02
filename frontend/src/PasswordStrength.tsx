// frontend/src/PasswordStrength.tsx
// Live password-strength meter for the registration form — checks 5 common
// rules (see passwordRules.ts), shows a color-coded bar + checklist. Purely
// presentational; the blocking behavior (minimum score required to
// register) lives in LoginPage's validate().
import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { REQUIREMENTS } from "./passwordRules";

const TIER: Record<number, { label: string; color: string }> = {
  0: { label: "Enter a password", color: "var(--red)" },
  1: { label: "Weak password", color: "var(--red)" },
  2: { label: "Medium password", color: "var(--amber)" },
  3: { label: "Strong password", color: "var(--amber-deep)" },
  4: { label: "Very strong password", color: "var(--green)" },
  5: { label: "Excellent password", color: "var(--green)" },
};

export default function PasswordStrength({ password }: { password: string }) {
  const { score, requirements } = useMemo(() => {
    const requirements = REQUIREMENTS.map((r) => ({ met: r.regex.test(password), text: r.text }));
    return { score: requirements.filter((r) => r.met).length, requirements };
  }, [password]);

  const tier = TIER[score];

  return (
    <div className="rv-pwstrength">
      <style>{PW_STYLES}</style>
      <div
        className="rv-pwstrength-bar"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-label="Password strength"
      >
        <div className="rv-pwstrength-fill" style={{ width: `${(score / 5) * 100}%`, background: tier.color }} />
      </div>
      <p className="rv-pwstrength-label" aria-live="polite">{tier.label}</p>
      <ul className="rv-pwstrength-list">
        {requirements.map((r) => (
          <li key={r.text} className={r.met ? "is-met" : ""}>
            {r.met ? <Check size={13} /> : <X size={13} />}
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PW_STYLES = `
  .rv-pwstrength { margin-top: 8px; }
  .rv-pwstrength-bar { height: 4px; border-radius: 999px; background: var(--rule); overflow: hidden; }
  .rv-pwstrength-fill { height: 100%; border-radius: 999px; transition: width .3s var(--ease-out-expo), background-color .3s ease; }
  .rv-pwstrength-label { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: var(--ink-muted); }
  .rv-pwstrength-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 12px; }
  .rv-pwstrength-list li { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-fade); }
  .rv-pwstrength-list li.is-met { color: var(--green); }
  .rv-pwstrength-list svg { flex-shrink: 0; }
  @media (prefers-reduced-motion: reduce) {
    .rv-pwstrength-fill { transition: none; }
  }
`;

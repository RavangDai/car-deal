// frontend/src/OnboardingFlow.tsx
// Four questions, asked once, that make the feed mean something.
//
// Runs for BOTH audiences and stores in two different places depending on who
// is asking: a signed-in user's answers go to users.preferences via the API, a
// guest's stay in localStorage until they make an account (see onboarding.ts).
// The component itself does not care which — it calls onFinish with the
// answers and lets the caller decide where they land.
//
// Skippable at every step, on purpose. A wall between a visitor and the
// product costs more than the personalization is worth, and a half-finished
// profile is a valid state the API round-trips rather than rejecting.
import { useMemo, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { Arrow, Button, Wordmark } from "./primitives";
import { CATEGORIES } from "./taxonomy";
import {
  SENSITIVITY_MIN_SCORE,
  useLocalOnboarding,
  type Cadence,
  type OnboardingAnswers,
  type Sensitivity,
} from "./onboarding";
import type { CategorySlug } from "./taxonomy";

const TOTAL_STEPS = 4;

const BUDGETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under $50", min: 0, max: 50 },
  { label: "$50 – $200", min: 50, max: 200 },
  { label: "$200 – $500", min: 200, max: 500 },
  { label: "$500 – $1,500", min: 500, max: 1500 },
  { label: "$1,500+", min: 1500, max: null },
  { label: "No limit", min: null, max: null },
];

const SENSITIVITIES: { value: Sensitivity; label: string; blurb: string }[] = [
  {
    value: "any",
    label: "Show me everything",
    blurb: "Any product that scored at all, however modest the drop.",
  },
  {
    value: "strong",
    label: "Only drops that hold up",
    blurb: `Score of ${SENSITIVITY_MIN_SCORE.strong}+. Real movement against the product's own history.`,
  },
  {
    value: "lowest",
    label: "Near-lowest-ever only",
    blurb: `Score of ${SENSITIVITY_MIN_SCORE.lowest}+. The rare end of the record.`,
  },
];

const CADENCES: { value: Cadence; label: string; blurb: string }[] = [
  { value: "instant", label: "As it happens", blurb: "Email the moment a watched price drops." },
  { value: "daily", label: "Daily digest", blurb: "One email a day with everything that moved." },
  { value: "weekly", label: "Weekly digest", blurb: "A single summary, once a week." },
  { value: "off", label: "No email", blurb: "Nothing sent. Check the dashboard when you like." },
];

export default function OnboardingFlow({
  onFinish,
  onSkip,
  saving = false,
  /** Shown on the final step so the ask matches who is answering. */
  isGuest = false,
  /**
   * Server-held answers for a signed-in user revisiting the flow. Without
   * this, "Change your answers" would open on defaults for anyone whose
   * profile lives on the account rather than in this browser's storage —
   * silently discarding what they had chosen.
   */
  initial,
}: {
  onFinish: (answers: OnboardingAnswers) => void;
  onSkip: () => void;
  saving?: boolean;
  isGuest?: boolean;
  initial?: OnboardingAnswers | null;
}) {
  const { answers, update } = useLocalOnboarding(initial ?? undefined);
  const [step, setStep] = useState(1);

  // Progress reflects steps COMPLETED, so step 1 reads 0% rather than 25% —
  // showing progress for work not yet done is the small lie that makes a
  // stepper feel fake.
  const pct = ((step - 1) / TOTAL_STEPS) * 100;

  const budgetIdx = useMemo(
    () =>
      BUDGETS.findIndex(
        (b) => b.min === answers.budget_min && b.max === answers.budget_max,
      ),
    [answers.budget_min, answers.budget_max],
  );

  function toggleCategory(slug: CategorySlug) {
    const has = answers.categories.includes(slug);
    update({
      categories: has
        ? answers.categories.filter((c) => c !== slug)
        : [...answers.categories, slug],
    });
  }

  function next() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    onFinish({ ...answers, completed_at: new Date().toISOString() });
  }

  return (
    <div className="rv-ob rv-page">
      <style>{ONBOARDING_STYLES}</style>

      <header className="rv-ob-bar">
        <a href="#" className="rv-ob-brand" aria-label="WasItCheaper home">
          <Wordmark size={20} />
        </a>
        <button type="button" className="rv-ob-skip" onClick={onSkip}>
          Skip for now
        </button>
      </header>

      <main className="rv-ob-main">
        <div className="rv-ob-card">
          <div className="rv-ob-progress">
            <div className="rv-ob-progress-meta">
              <span className="rv-num">
                Step {step} of {TOTAL_STEPS}
              </span>
              <span className="rv-num">{Math.round(pct)}% complete</span>
            </div>
            <div
              className="rv-ob-track"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Onboarding progress"
            >
              <div className="rv-ob-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="rv-ob-body">
            {step === 1 && (
              <Step
                eyebrow="What you shop for"
                title="What do you actually buy?"
                lede="Pick as many as you like. We use this to decide what surfaces first — you can still track anything from any store."
              >
                <div className="rv-ob-grid">
                  {CATEGORIES.map((c) => {
                    const on = answers.categories.includes(c.slug);
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        className={`rv-ob-chip${on ? " is-on" : ""}`}
                        onClick={() => toggleCategory(c.slug)}
                        aria-pressed={on}
                      >
                        <span className="rv-ob-chip-check" aria-hidden="true">
                          {on && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="rv-ob-chip-text">
                          <b>{c.label}</b>
                          <i>{c.hint}</i>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step
                eyebrow="Budget"
                title="What are you usually spending?"
                lede="A rough band is plenty. It keeps $2,000 laptops out of your feed if you are shopping for kettles."
              >
                <div className="rv-ob-options">
                  {BUDGETS.map((b, i) => (
                    <button
                      key={b.label}
                      type="button"
                      className={`rv-ob-opt${budgetIdx === i ? " is-on" : ""}`}
                      onClick={() => update({ budget_min: b.min, budget_max: b.max })}
                      aria-pressed={budgetIdx === i}
                    >
                      <span className="rv-ob-opt-label">{b.label}</span>
                    </button>
                  ))}
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step
                eyebrow="Sensitivity"
                title="How picky should we be?"
                lede="This sets the minimum deal score we will put in front of you. Every score is measured against that product's own ninety-day history."
              >
                <div className="rv-ob-stack">
                  {SENSITIVITIES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`rv-ob-row${answers.sensitivity === s.value ? " is-on" : ""}`}
                      onClick={() => update({ sensitivity: s.value })}
                      aria-pressed={answers.sensitivity === s.value}
                    >
                      <span className="rv-ob-radio" aria-hidden="true" />
                      <span className="rv-ob-row-text">
                        <b>{s.label}</b>
                        <i>{s.blurb}</i>
                      </span>
                    </button>
                  ))}
                </div>
              </Step>
            )}

            {step === 4 && (
              <Step
                eyebrow="Alerts"
                title="When should we tell you?"
                lede={
                  isGuest
                    ? "Pick a cadence now — we will remember it, and it starts working the moment you make an account."
                    : "You can change this any time from your alerts page."
                }
              >
                <div className="rv-ob-stack">
                  {CADENCES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={`rv-ob-row${answers.alert_cadence === c.value ? " is-on" : ""}`}
                      onClick={() => update({ alert_cadence: c.value })}
                      aria-pressed={answers.alert_cadence === c.value}
                    >
                      <span className="rv-ob-radio" aria-hidden="true" />
                      <span className="rv-ob-row-text">
                        <b>{c.label}</b>
                        <i>{c.blurb}</i>
                      </span>
                    </button>
                  ))}
                </div>
              </Step>
            )}
          </div>

          <div className="rv-ob-nav">
            <Button
              variant="quiet"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ChevronLeft size={15} strokeWidth={2} />
              <span>Back</span>
            </Button>
            <Button onClick={next} disabled={saving}>
              <span>
                {saving ? "Saving…" : step === TOTAL_STEPS ? "Show me deals" : "Continue"}
              </span>
              {!saving && <Arrow size={14} />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Step({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="rv-eyebrow">{eyebrow}</p>
      <h1 className="rv-display rv-ob-title">{title}</h1>
      <p className="rv-ob-lede">{lede}</p>
      {children}
    </>
  );
}

const ONBOARDING_STYLES = `
  .rv-ob { min-height: 100dvh; display: flex; flex-direction: column; }

  .rv-ob-bar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding: 22px var(--gutter);
    max-width: var(--measure); margin: 0 auto; width: 100%;
  }
  .rv-ob-brand { text-decoration: none; display: inline-flex; }
  .rv-ob-skip {
    font-size: 13.5px; font-weight: 500; color: var(--ink-muted);
    background: none; border: none; cursor: pointer; padding: 8px 4px;
    text-decoration: underline; text-underline-offset: 3px;
    text-decoration-color: var(--rule-strong);
    transition: color var(--dur-mid) var(--ease-out-soft);
  }
  .rv-ob-skip:hover { color: var(--ink); }

  .rv-ob-main {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 12px var(--gutter) clamp(40px, 8vh, 88px);
  }

  /* Double-bezel: the card is the only object on the screen, so it has to
     read as one rather than as a bordered div. */
  .rv-ob-card {
    width: 100%; max-width: 40rem;
    padding: var(--bezel-pad);
    border-radius: var(--bezel-outer);
    background: linear-gradient(180deg, rgba(255,255,255,.8), rgba(226,224,216,.45));
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.9),
      0 0 0 1px rgba(27,26,22,.055),
      var(--shadow-xl);
  }
  .rv-ob-card > * { position: relative; }
  .rv-ob-progress, .rv-ob-body, .rv-ob-nav {
    background: var(--paper-pale);
  }
  .rv-ob-progress {
    border-radius: var(--bezel-inner) var(--bezel-inner) 0 0;
    box-shadow: var(--shadow-lip);
    padding: 22px clamp(20px, 3.5vw, 34px) 18px;
  }
  .rv-ob-progress-meta {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; margin-bottom: 10px;
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    text-transform: uppercase; letter-spacing: .11em; color: var(--ink-muted);
  }
  .rv-ob-track {
    height: 5px; border-radius: var(--r-pill);
    background: var(--paper-deep); overflow: hidden;
  }
  .rv-ob-fill {
    height: 100%; border-radius: var(--r-pill); background: var(--green);
    transition: width var(--dur-lux) var(--ease-spring);
  }

  .rv-ob-body {
    padding: clamp(22px, 3vw, 32px) clamp(20px, 3.5vw, 34px);
    border-top: 1px solid var(--rule);
    min-height: 24rem;
  }
  .rv-ob-title { font-size: clamp(28px, 3.6vw, 40px); margin: 12px 0 0; }
  .rv-ob-lede {
    margin: 14px 0 26px; font-size: 15px; line-height: 1.6;
    color: var(--ink-muted); max-width: 44ch;
  }

  /* ── Category chips ── */
  .rv-ob-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
  }
  .rv-ob-chip {
    display: flex; align-items: flex-start; gap: 11px; text-align: left;
    padding: 13px 14px; cursor: pointer;
    border: 1px solid var(--rule-strong); border-radius: var(--r-md);
    background: var(--paper-pale);
    transition: border-color var(--dur-mid) var(--ease-out-soft),
                background-color var(--dur-mid) var(--ease-out-soft),
                transform var(--dur-lux) var(--ease-spring);
  }
  .rv-ob-chip:hover { border-color: var(--ink-fade); }
  .rv-ob-chip:active { transform: scale(.985); transition-duration: .08s; }
  .rv-ob-chip.is-on { border-color: var(--ink); background: var(--green-tint); }
  .rv-ob-chip-check {
    flex: none; width: 17px; height: 17px; margin-top: 1px;
    border-radius: var(--r-sm); border: 1px solid var(--rule-strong);
    background: var(--paper-pale); color: var(--paper);
    display: inline-flex; align-items: center; justify-content: center;
    transition: background-color var(--dur-mid) var(--ease-out-soft),
                border-color var(--dur-mid) var(--ease-out-soft);
  }
  .rv-ob-chip.is-on .rv-ob-chip-check {
    background: var(--green-deep); border-color: var(--green-deep);
  }
  .rv-ob-chip-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rv-ob-chip-text b { font-size: 14px; font-weight: 600; color: var(--ink); }
  .rv-ob-chip-text i {
    font-style: normal; font-size: 12px; color: var(--ink-muted); line-height: 1.4;
  }

  /* ── Budget pills ── */
  .rv-ob-options { display: flex; flex-wrap: wrap; gap: 10px; }
  .rv-ob-opt {
    padding: 11px 18px; cursor: pointer;
    border: 1px solid var(--rule-strong); border-radius: var(--r-pill);
    background: var(--paper-pale);
    font-size: 14.5px; font-weight: 600; color: var(--ink);
    transition: border-color var(--dur-mid) var(--ease-out-soft),
                background-color var(--dur-mid) var(--ease-out-soft),
                color var(--dur-mid) var(--ease-out-soft),
                transform var(--dur-lux) var(--ease-spring);
  }
  .rv-ob-opt:hover { border-color: var(--ink-fade); }
  .rv-ob-opt:active { transform: scale(.97); transition-duration: .08s; }
  .rv-ob-opt.is-on {
    background: var(--ink); border-color: var(--ink); color: var(--paper);
  }

  /* ── Radio rows ── */
  .rv-ob-stack { display: flex; flex-direction: column; gap: 10px; }
  .rv-ob-row {
    display: flex; align-items: flex-start; gap: 13px; text-align: left;
    padding: 15px 16px; cursor: pointer;
    border: 1px solid var(--rule-strong); border-radius: var(--r-md);
    background: var(--paper-pale);
    transition: border-color var(--dur-mid) var(--ease-out-soft),
                background-color var(--dur-mid) var(--ease-out-soft),
                transform var(--dur-lux) var(--ease-spring);
  }
  .rv-ob-row:hover { border-color: var(--ink-fade); }
  .rv-ob-row:active { transform: scale(.99); transition-duration: .08s; }
  .rv-ob-row.is-on { border-color: var(--ink); background: var(--green-tint); }
  .rv-ob-radio {
    flex: none; width: 16px; height: 16px; margin-top: 2px;
    border-radius: var(--r-pill); border: 1px solid var(--rule-strong);
    background: var(--paper-pale);
    transition: border-color var(--dur-mid) var(--ease-out-soft),
                box-shadow var(--dur-mid) var(--ease-out-soft);
  }
  .rv-ob-row.is-on .rv-ob-radio {
    border-color: var(--green-deep);
    box-shadow: inset 0 0 0 4px var(--green-deep);
  }
  .rv-ob-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .rv-ob-row-text b { font-size: 15px; font-weight: 600; color: var(--ink); }
  .rv-ob-row-text i {
    font-style: normal; font-size: 13px; color: var(--ink-muted); line-height: 1.5;
  }

  .rv-ob-nav {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding: 18px clamp(20px, 3.5vw, 34px);
    border-top: 1px solid var(--rule);
    border-radius: 0 0 var(--bezel-inner) var(--bezel-inner);
  }

  @media (max-width: 560px) {
    .rv-ob-grid { grid-template-columns: minmax(0, 1fr); }
    .rv-ob-body { min-height: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-ob-fill, .rv-ob-chip, .rv-ob-opt, .rv-ob-row { transition: none !important; }
    .rv-ob-chip:active, .rv-ob-opt:active, .rv-ob-row:active { transform: none !important; }
  }
`;

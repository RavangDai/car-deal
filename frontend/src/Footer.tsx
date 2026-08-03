// frontend/src/Footer.tsx
// Site footer — brand + a small real link set (Product/Legal, not a padded
// generic grid), a re-skinned real donation flow in the "newsletter" visual
// slot, and a staggered per-column reveal via the shared Reveal primitive.
// Rendered inside HomePage's `.rv-catalog` wrapper, so it inherits that
// scope's shared classes (.rv-wordmark, .rv-eyebrow, etc.) for free.
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { createDonationCheckout } from "./api";
import { Reveal, Wordmark } from "./primitives";

const DONATE_PRESETS = [3, 5, 10] as const;

export default function Footer({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <footer className="rv-footer">
      <style>{FOOTER_STYLES}</style>
      <div className="rv-section-inner rv-footer-inner">
        <div className="rv-footer-grid">
          <Reveal className="rv-footer-col rv-footer-brand">
            <a href="#" className="rv-footer-mark"><Wordmark size={22} /></a>
            <p className="rv-footer-tagline">
              Real price history for anything you shop for. Every price we show was recorded, not claimed.
            </p>
          </Reveal>

          <Reveal className="rv-footer-col" delay={0.06}>
            <h3 className="rv-footer-heading">Product</h3>
            <ul className="rv-footer-links">
              <li><a href="#deals">Deals</a></li>
              <li><a href="#how">How it works</a></li>
              <li><button type="button" onClick={onGetStarted}>Sign in</button></li>
            </ul>
          </Reveal>

          <Reveal className="rv-footer-col" delay={0.12}>
            <h3 className="rv-footer-heading">Legal</h3>
            <ul className="rv-footer-links">
              <li><a href="#/terms">Terms</a></li>
              <li><a href="#/privacy">Privacy</a></li>
            </ul>
          </Reveal>

          <Reveal className="rv-footer-col rv-footer-donate-col" delay={0.18}>
            <h3 className="rv-footer-heading">Keep it running</h3>
            <p className="rv-footer-donate-copy">WasItCheaper is free to track. Donations are optional.</p>
            <DonatePill />
          </Reveal>
        </div>

        <Reveal className="rv-footer-bottom" delay={0.24}>
          <span className="rv-footer-copy">© 2026 WasItCheaper · Built for shoppers, not sellers.</span>
        </Reveal>
      </div>
    </footer>
  );
}

function DonatePill() {
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A typed custom value wins over the preset chips.
  const cents = useMemo(() => {
    const dollars = custom.trim() ? Number(custom) : amount;
    return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
  }, [custom, amount]);

  async function donate() {
    if (cents < 100 || cents > 50000) {
      setError("Enter an amount between $1 and $500.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { url } = await createDonationCheckout(cents);
      window.location.href = url; // hand off to Stripe Checkout
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /503/.test(msg)
          ? "Donations aren't set up yet — check back soon."
          : "Couldn't start checkout. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <div className="rv-donate-pill-wrap">
      <div className="rv-donate-presets">
        {DONATE_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setAmount(d); setCustom(""); setError(null); }}
            className={`rv-donate-chip ${!custom && amount === d ? "rv-donate-chip-on" : ""}`}
          >
            ${d}
          </button>
        ))}
      </div>
      <div className="rv-donate-pill">
        <span className="rv-donate-pill-sign">$</span>
        <input
          type="number" min={1} max={500} inputMode="numeric"
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setError(null); }}
          placeholder={String(amount)}
          className="rv-donate-pill-input"
          aria-label="Donation amount in dollars"
        />
        <button type="button" onClick={donate} disabled={pending} className="rv-donate-pill-btn" aria-label="Donate">
          <ArrowRight size={16} />
        </button>
      </div>
      {error && <p className="rv-donate-error">{error}</p>}
    </div>
  );
}

const FOOTER_STYLES = `
  .rv-footer { background: var(--paper-pale); border-top: 1px solid var(--rule-strong); padding: 56px 0 32px; }
  .rv-footer-inner { position: relative; }
  .rv-footer-mark { text-decoration: none; display: inline-flex; }
  .rv-footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.6fr; gap: 32px; padding-bottom: 32px; }
  @media (max-width: 760px) {
    .rv-footer-grid { grid-template-columns: 1fr 1fr; }
    .rv-footer-brand, .rv-footer-donate-col { grid-column: 1 / -1; }
  }
  .rv-footer-col { display: flex; flex-direction: column; gap: 10px; }
  .rv-footer-tagline { font-size: 13.5px; color: var(--ink-muted); max-width: 32ch; line-height: 1.5; margin-top: 4px; }
  .rv-footer-heading {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--ink-muted); margin: 0 0 4px;
  }
  .rv-footer-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .rv-footer-links a, .rv-footer-links button {
    font-size: 14px; font-weight: 500; color: var(--ink-muted); text-align: left;
    background: none; cursor: pointer; text-decoration: none;
    transition: color var(--dur-fast) ease;
  }
  .rv-footer-links a:hover, .rv-footer-links button:hover { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
  .rv-footer-donate-copy { font-size: 13px; color: var(--ink-muted); margin: 0; line-height: 1.5; }

  .rv-donate-pill-wrap { display: flex; flex-direction: column; gap: 10px; }
  .rv-donate-presets { display: flex; gap: 6px; }
  .rv-donate-chip {
    padding: 7px 12px; border-radius: var(--r-md); border: 1px solid var(--rule-strong);
    font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; color: var(--ink);
    background: var(--paper-pale); cursor: pointer; font-variant-numeric: tabular-nums;
    transition: border-color var(--dur-fast) ease, background-color var(--dur-fast) ease, color var(--dur-fast) ease;
  }
  .rv-donate-chip:hover { border-color: var(--ink); }
  .rv-donate-chip-on { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .rv-donate-pill {
    display: flex; align-items: center;
    border: 1px solid var(--rule-strong); border-radius: var(--r-md);
    background: var(--paper-pale); overflow: hidden;
  }
  .rv-donate-pill-sign { padding-left: 12px; font-family: var(--font-mono); font-size: 13px; color: var(--ink-muted); }
  .rv-donate-pill-input {
    flex: 1; min-width: 0; border: none; outline: none; background: transparent;
    font-family: var(--font-mono); font-size: 13.5px; font-weight: 500; color: var(--ink);
    padding: 10px 8px;
  }
  .rv-donate-pill-input::-webkit-outer-spin-button, .rv-donate-pill-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .rv-donate-pill-btn {
    width: 32px; height: 32px; margin: 3px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: var(--r-sm); background: var(--ink); color: var(--paper); cursor: pointer;
    transition: background-color var(--dur-fast) ease;
  }
  .rv-donate-pill-btn:hover:not(:disabled) { background: #000; }
  .rv-donate-pill-btn:disabled { opacity: .6; cursor: wait; }
  .rv-donate-error { font-size: 12.5px; color: var(--err); margin: 4px 0 0; }

  .rv-footer-bottom { padding-top: 22px; border-top: 1px solid var(--rule); }
  .rv-footer-copy { font-size: 13px; color: var(--ink-fade); }
`;

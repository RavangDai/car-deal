// Alert history (#/alerts) — every price-drop email fired for the signed-in
// user, audited from the real alert_events table (not a client-side log).
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAlerts, useProduct } from "./hooks";
import { formatMoney } from "./format";
import { Spinner } from "./Spinner";
import { RetroWindow, Taskbar } from "./primitives";
import type { AlertEvent } from "./api";

const RULE_LABEL: Record<string, string> = {
  any_drop: "Any drop",
  percent_drop: "Percent drop",
  target_price: "Target price",
};

function timeLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AlertsPage({ onBack }: { onBack: () => void }) {
  const { data: alerts, isLoading } = useAlerts();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="rv-alerts rv-page min-h-screen">
      <style>{ALERTS_STYLES}</style>

      <header className="rv-alerts-nav">
        <div className="rv-alerts-nav-inner">
          <button onClick={onBack} className="rv-alerts-back">
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
        </div>
      </header>

      <Taskbar
        links={[{ href: "#", label: "Home" }, { href: "#/alerts", label: "Alerts" }]}
        activeHref="#/alerts"
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <main className="rv-alerts-main">
        <h1 className="rv-alerts-title">Alert history</h1>
        <p className="rv-alerts-sub">Every price-drop email we've sent you, most recent first.</p>

        {isLoading && (
          <div className="rv-alerts-state">
            <Spinner size={18} />
            <p>Loading alerts…</p>
          </div>
        )}

        {!isLoading && (alerts ?? []).length === 0 && (
          <RetroWindow title="alerts.log" bodyClassName="rv-alerts-empty">
            <p className="rv-alerts-empty-title">No alerts yet.</p>
            <p className="rv-alerts-empty-sub">
              Track a product and set an alert rule — we'll email you the moment the price genuinely drops.
            </p>
          </RetroWindow>
        )}

        {!isLoading && (alerts ?? []).length > 0 && (
          <RetroWindow title="alerts.log" bodyClassName="p-0">
            <ul className="rv-alerts-list">
              {(alerts ?? []).map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </ul>
          </RetroWindow>
        )}
      </main>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertEvent }) {
  const { data: product } = useProduct(alert.product_id);
  const currency = product?.currency ?? "USD";

  return (
    <li className="rv-alert-row">
      <div className="min-w-0">
        <a href={`#/product/${alert.product_id}`} className="rv-alert-product">
          {product?.title ?? product?.domain ?? "Product"}
        </a>
        <p className="rv-alert-meta">
          {RULE_LABEL[alert.rule_type] ?? alert.rule_type} · {timeLabel(alert.created_at)}
        </p>
      </div>
      <div className="rv-alert-price">
        {alert.previous_price != null && (
          <span className="rv-alert-price-old">{formatMoney(alert.previous_price, currency)}</span>
        )}
        <span className="rv-alert-price-new">{formatMoney(alert.new_price, currency)}</span>
      </div>
      <span className={`rv-alert-status rv-alert-status-${alert.status}`}>{alert.status}</span>
    </li>
  );
}

const ALERTS_STYLES = `
  .rv-alerts {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .rv-alerts-nav { border-bottom: 1px solid var(--rule); background: var(--paper-pale); }
  .rv-alerts-nav-inner {
    max-width: 780px; margin: 0 auto; padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .rv-alerts-back {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 600; color: var(--ink-muted);
    transition: color .15s ease;
  }
  .rv-alerts-back:hover { color: var(--ink); }

  .rv-alerts-main { max-width: 780px; margin: 0 auto; padding: 40px 24px 64px; }
  .rv-alerts-title { font-family: var(--font-display); font-weight: 400; font-size: clamp(1.9rem, 3.2vw, 2.4rem); letter-spacing: 0.01em; }
  .rv-alerts-sub { margin-top: 8px; font-size: 14.5px; color: var(--ink-muted); margin-bottom: 32px; }

  .rv-alerts-state { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--ink-muted); }

  .rv-alerts-empty { text-align: center; padding: 60px 20px; }
  .rv-alerts-empty-title { font-family: var(--font-display); font-weight: 400; font-size: 1.5rem; margin-bottom: 8px; }
  .rv-alerts-empty-sub { font-size: 14px; color: var(--ink-muted); max-width: 42ch; margin: 0 auto; line-height: 1.5; }

  .rv-alerts-list { list-style: none; margin: 0; padding: 0; }
  .rv-alert-row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center; gap: 16px;
    padding: 16px 18px; border-top: 1px solid var(--rule);
  }
  .rv-alerts-list > .rv-alert-row:first-child { border-top: none; }
  .rv-alert-product { font-size: 14.5px; font-weight: 700; color: var(--ink); display: block; }
  .rv-alert-product:hover { color: var(--primary); }
  .rv-alert-meta { font-size: 12.5px; color: var(--ink-muted); margin-top: 2px; }
  .rv-alert-price { display: flex; align-items: baseline; gap: 8px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rv-alert-price-old { font-size: 12.5px; color: var(--ink-fade); text-decoration: line-through; }
  .rv-alert-price-new { font-size: 14.5px; font-weight: 800; color: var(--green); }
  .rv-alert-status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  .rv-alert-status-sent { background: var(--green-tint); color: var(--green-deep); }
  .rv-alert-status-pending { background: var(--amber-tint); color: var(--amber-deep); }
  .rv-alert-status-failed { background: color-mix(in srgb, var(--err) 15%, transparent); color: var(--err); }

  @media (max-width: 560px) {
    .rv-alert-row { grid-template-columns: 1fr; gap: 6px; }
    .rv-alert-price { order: 3; }
    .rv-alert-status { order: 2; justify-self: start; }
  }
`;

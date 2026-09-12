// Alert history (#/alerts) — every price-drop alert that fired, audited from
// the real alert_events table (not a client-side log).
//
// "Fired" and "emailed" are not the same thing, and the page must not conflate
// them: tracking no longer requires an account, so an alert can legitimately
// fire for someone who has given no address. Those are recorded server-side as
// `no_recipient` and shown here plainly rather than as a failure.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAlerts, useProduct } from "./hooks";
import { formatMoney } from "./format";
import { Spinner } from "./Spinner";
import { Button, Delta, Panel, Stamp, TopBar } from "./primitives";
import type { AlertEvent } from "./api";

// Server-side statuses (see AlertEvent.status in models.py). Rendering the raw
// slug leaks database vocabulary into the UI and, for `no_recipient`, reads as
// an error when nothing went wrong.
const STATUS_LABEL: Record<string, string> = {
  sent: "emailed",
  pending: "sending",
  failed: "delivery failed",
  no_recipient: "not emailed — no address on file",
};

const STATUS_TONE: Record<string, "signal" | "caution" | "quiet"> = {
  sent: "signal",
  pending: "caution",
  failed: "caution",
  no_recipient: "quiet",
};

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
  const rows = alerts ?? [];
  // Counting every row as "sent" was wrong the moment a row could be pending,
  // failed, or undeliverable.
  const sentCount = rows.filter((a) => a.status === "sent").length;
  const undelivered = rows.filter((a) => a.status === "no_recipient").length;

  return (
    <div className="rv-alerts rv-page min-h-screen">
      <style>{ALERTS_STYLES}</style>

      <TopBar
        links={[{ href: "#", label: "Today's deals" }, { href: "#/alerts", label: "Alerts" }]}
        activeHref="#/alerts"
        status={rows.length > 0 ? `${rows.length} fired · ${sentCount} emailed` : undefined}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <main className="rv-alerts-main">
        <button onClick={onBack} className="rv-alerts-back">
          <ArrowLeft size={15} />
          <span>Back</span>
        </button>

        <h1 className="rv-alerts-title">Alert history</h1>
        <p className="rv-alerts-sub">
          Every alert that has fired, most recent first. An alert is only recorded here when the
          rule you set actually fired.
        </p>

        {/* Not a wall and not an error -- these alerts really did fire and are
            listed below. There is just no address to send them to yet, which
            makes this the one moment an account is genuinely worth something. */}
        {undelivered > 0 && (
          <Panel label="Add an email to receive these">
            <p className="rv-alerts-undelivered">
              {undelivered === 1
                ? "One of these alerts fired but wasn't emailed"
                : `${undelivered} of these alerts fired but weren't emailed`}{" "}
              &mdash; you&rsquo;re tracking as a guest, so there&rsquo;s no address on file.
              Everything still works and it&rsquo;s saved to this browser.
            </p>
            <Button as="a" href="#/login" variant="primary" size="sm">
              Add an email to get these
            </Button>
          </Panel>
        )}

        {isLoading && (
          <div className="rv-alerts-state">
            <Spinner size={18} />
            <p>Loading alerts&hellip;</p>
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <Panel label="Alerts">
            <p className="rv-alerts-empty-title">No alerts have fired yet.</p>
            <p className="rv-alerts-empty-sub">
              Open any tracked product and set a rule &mdash; any drop, a percentage, or a price you
              name. We check daily and email you the moment it fires.
            </p>
            <Button as="a" href="#" variant="primary" size="sm">Go to your products</Button>
          </Panel>
        )}

        {!isLoading && rows.length > 0 && (
          <Panel label="Alerts" aside={`${rows.length} total`}>
            <ul className="rv-alerts-list">
              {rows.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </ul>
          </Panel>
        )}
      </main>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertEvent }) {
  const { data: product } = useProduct(alert.product_id);
  const currency = product?.currency ?? "USD";

  // The drop this alert actually reported, computed from the two prices the
  // event recorded — not re-derived from the product's current state.
  const dropPct =
    alert.previous_price != null && Number(alert.previous_price) > 0
      ? ((Number(alert.previous_price) - Number(alert.new_price)) / Number(alert.previous_price)) * 100
      : null;

  const tone = STATUS_TONE[alert.status] ?? "quiet";
  const statusLabel = STATUS_LABEL[alert.status] ?? alert.status;

  return (
    <li className="rv-alert-row">
      <div className="rv-alert-id">
        <a href={`#/product/${alert.product_id}`} className="rv-alert-product">
          {product?.title ?? product?.domain ?? "Product"}
        </a>
        <p className="rv-alert-meta rv-num">
          {RULE_LABEL[alert.rule_type] ?? alert.rule_type} &middot; {timeLabel(alert.created_at)}
        </p>
      </div>

      <div className="rv-alert-price">
        {alert.previous_price != null && (
          <s className="rv-alert-price-old rv-num">{formatMoney(alert.previous_price, currency)}</s>
        )}
        <span className="rv-alert-price-new rv-num">{formatMoney(alert.new_price, currency)}</span>
      </div>

      <div className="rv-alert-delta">
        <Delta pct={dropPct} size="md" />
      </div>

      <Stamp tone={tone}>{statusLabel}</Stamp>
    </li>
  );
}

const ALERTS_STYLES = `
  .rv-alerts { background: var(--ground); color: var(--ink); font-family: var(--font-sans); }
  .rv-alerts-undelivered {
    margin: 0 0 16px; font-size: 14px; line-height: 1.6;
    color: var(--ink-muted); max-width: 60ch;
  }
  .rv-alerts-main { max-width: 860px; margin: 0 auto; padding: 26px 24px 72px; }

  .rv-alerts-back {
    display: inline-flex; align-items: center; gap: 8px; background: none; cursor: pointer;
    font-size: 13.5px; font-weight: 500; color: var(--ink-muted); padding: 4px 0; margin-bottom: 28px;
    transition: color var(--dur-fast) ease;
  }
  .rv-alerts-back:hover { color: var(--ink); }

  .rv-alerts-title { margin: 0; font-size: clamp(28px, 3.6vw, 38px); font-weight: 700; letter-spacing: -0.03em; }
  .rv-alerts-sub { margin: 12px 0 36px; font-size: 15px; line-height: 1.6; color: var(--ink-muted); max-width: 58ch; }

  .rv-alerts-state { display: flex; align-items: center; gap: 12px; padding: 40px 0; color: var(--ink-muted); }

  .rv-alerts-empty-title { margin: 0 0 8px; font-size: 17px; font-weight: 600; }
  .rv-alerts-empty-sub { margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: var(--ink-muted); max-width: 52ch; }

  .rv-alerts-list { list-style: none; margin: 0; padding: 0; }
  .rv-alert-row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto 96px 76px;
    align-items: center; gap: 18px; padding: 15px 0; border-bottom: 1px solid var(--rule);
  }
  .rv-alert-row:last-child { border-bottom: 0; }
  .rv-alert-id { min-width: 0; }
  .rv-alert-product {
    font-size: 14.5px; font-weight: 600; color: var(--ink); display: block; text-decoration: none;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rv-alert-product:hover { text-decoration: underline; text-underline-offset: 3px; }
  .rv-alert-meta { font-size: 11.5px; color: var(--ink-muted); margin: 4px 0 0; }

  .rv-alert-price { display: flex; align-items: baseline; gap: 9px; white-space: nowrap; }
  .rv-alert-price-old { font-size: 12.5px; color: var(--ink-fade); }
  .rv-alert-price-new { font-size: 15.5px; font-weight: 600; color: var(--ink); }
  .rv-alert-delta { display: flex; justify-content: flex-end; }

  @media (max-width: 640px) {
    .rv-alerts-main { padding: 20px 18px 56px; }
    .rv-alert-row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "id id" "price delta" "status status";
      gap: 10px 14px; padding: 18px 0;
    }
    .rv-alert-id { grid-area: id; }
    .rv-alert-price { grid-area: price; }
    .rv-alert-delta { grid-area: delta; justify-content: flex-start; }
    .rv-alert-row > .rv-stamp { grid-area: status; justify-self: start; }
  }
`;

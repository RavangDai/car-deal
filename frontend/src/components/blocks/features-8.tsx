// The machinery section. Sits between the score (#how) and the closing CTA:
// the score section says how a number is computed, this says what gets the
// prices in, keeps them intact, and decides when a change is worth a look.
//
// Two copy rules carried over from ScoreExplainer.tsx, both load-bearing:
//   1. Nothing here claims a capability the deployment does not have. The
//      unblocking proxy is coded but disabled (unblocker_provider defaults
//      to ""), and the email backend is "console", so neither is sold here.
//      Cell 5 describes the rule engine, which is real, and stops there.
//   2. The verdict is the only AI on the page and it is described as what it
//      is: narration of statistics it did not compute. dealmath.py is
//      arithmetic, and calling it a model would be the one unforgivable copy
//      error on a page whose whole pitch is "we keep the receipts".
//
// Layout is the 6-column bento from the source block: 2+2+2 over 3+3 at lg,
// full-width stacked below sm. Five cells for five things, no filler tile.
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/charts";
import type { PricePointLike } from "@/charts";
import { Stamp } from "@/primitives";
import { useReveal } from "@/motion";

// The extraction chain, in the order pipeline.py actually tries it. The keys
// are the literal strategy values structured.py returns.
const STRATEGIES: [string, string][] = [
  ["json_ld", "Schema.org product block"],
  ["og_meta", "OpenGraph price tags"],
  ["microdata", "Inline itemprop markup"],
];

// The three rule types watches_api.py accepts. Labels are the plain-language
// versions already used on the product detail page.
const RULES: [string, string][] = [
  ["any_drop", "The price drops at all"],
  ["percent_drop", "It drops by at least a percentage"],
  ["target_price", "It reaches a price I name"],
];

export function Features({
  points = [],
  median = null,
}: {
  /** Real recorded history for the featured product. Fewer than two points
   *  renders Sparkline's own dashed empty state rather than a drawn guess. */
  points?: PricePointLike[];
  median?: number | null;
}) {
  const sectionRef = useReveal<HTMLDivElement>({ y: 44, stagger: 0.07 });

  return (
    <section
      className="py-[var(--space-section)]"
      id="features"
      data-rv-section="features"
    >
      <div
        className="mx-auto max-w-[var(--measure)] px-[var(--gutter)]"
        ref={sectionRef}
      >
        <header className="max-w-[46rem]">
          <p className="rv-eyebrow" data-reveal>
            The machinery
          </p>
          <h2
            className="rv-display mt-[14px] text-[clamp(34px,4.6vw,58px)]"
            data-reveal
          >
            The parts that keep it <em>honest</em>.
          </h2>
          <p
            className="mt-5 max-w-[40rem] text-[clamp(15.5px,1.35vw,17.5px)] leading-[1.62] text-[var(--ink-soft)]"
            data-reveal
          >
            The score is arithmetic over prices we recorded ourselves. These are
            the pieces that get those prices in, keep them intact, and decide
            when a change is worth your attention.
          </p>
        </header>

        <div className="relative z-10 mt-[clamp(40px,5vw,64px)] grid grid-cols-6 gap-3">
          {/* 1 - Extraction */}
          <Card
            className="col-span-full overflow-hidden lg:col-span-2"
            data-reveal
          >
            <CardContent className="pt-6">
              <p className="rv-panel-label">Extraction</p>
              <h3 className="rv-display-sm mt-3 text-[19px]">
                It reads the page itself.
              </h3>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-[var(--ink-muted)]">
                Structured data first, in this order. No model runs unless all
                three come back empty.
              </p>

              <ol className="mt-5 border-t border-[var(--rule)]">
                {STRATEGIES.map(([strategy, what], i) => (
                  <li
                    key={strategy}
                    className="flex items-baseline gap-3 border-b border-[var(--rule)] py-2.5"
                  >
                    <span className="rv-num text-[11px] text-[var(--ink-fade)]">
                      0{i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="rv-num block text-[12.5px] text-[var(--ink)]">
                        {strategy}
                      </span>
                      <span className="block text-[12.5px] text-[var(--ink-muted)]">
                        {what}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              <p className="mt-4 text-[13px] leading-[1.55] text-[var(--ink-muted)]">
                A recheck retries the free path first, so a product drops off
                the model the day its store publishes clean data.
              </p>
            </CardContent>
          </Card>

          {/* 2 - Append-only history, drawn from a real recorded series. */}
          <Card
            className="col-span-full overflow-hidden sm:col-span-3 lg:col-span-2"
            data-reveal
          >
            <CardContent className="pt-6">
              <p className="rv-panel-label">History</p>
              <h3 className="rv-display-sm mt-3 text-[19px]">
                Recorded, never overwritten.
              </h3>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-[var(--ink-muted)]">
                Every check appends a row. Prices are stored as exact decimals,
                so nothing that was true yesterday is edited today.
              </p>

              {/* A real recorded series for a product we track, drawn with the
                  same monotone-cubic line as the detail chart. Under two
                  points Sparkline draws its dashed rule instead: an absence
                  of data must never read as a flat price. */}
              <figure className="m-0 mt-6">
                <div className="rounded-[var(--r-sm)] border border-[var(--rule)] bg-[var(--paper-pale)] px-3 py-4">
                  <Sparkline
                    points={points}
                    median={median}
                    width={240}
                    height={56}
                  />
                </div>
                <figcaption className="mt-3 text-[12.5px] leading-[1.5] text-[var(--ink-muted)]">
                  {points.length >= 2
                    ? "A product we are tracking now. The line passes through every price we recorded, and can never dip below the lowest of them."
                    : "No series is drawn until there are at least two recorded checks."}
                </figcaption>
              </figure>
            </CardContent>
          </Card>

          {/* 3 - URL identity */}
          <Card
            className="col-span-full overflow-hidden sm:col-span-3 lg:col-span-2"
            data-reveal
          >
            <CardContent className="pt-6">
              <p className="rv-panel-label">Identity</p>
              <h3 className="rv-display-sm mt-3 text-[19px]">
                One product, however you link to it.
              </h3>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-[var(--ink-muted)]">
                Tracking parameters are stripped and what remains is hashed, so
                two people pasting the same product land on the same history
                instead of starting two.
              </p>

              <div className="mt-6 space-y-2.5">
                <div className="rounded-[var(--r-sm)] border border-[var(--rule)] bg-[var(--paper-soft)] px-3 py-2.5">
                  <p className="rv-num truncate text-[12px] text-[var(--ink-fade)] line-through">
                    /p/kettle?utm_source=mail
                  </p>
                </div>
                <div className="rounded-[var(--r-sm)] border border-[var(--rule)] bg-[var(--paper-pale)] px-3 py-2.5">
                  <p className="rv-num truncate text-[12px] text-[var(--ink)]">
                    /p/kettle
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-[1.55] text-[var(--ink-muted)]">
                Both links resolve to one tracked row, and one shared history.
              </p>
            </CardContent>
          </Card>

          {/* 4 - The AI boundary. The strongest claim in the section. */}
          <Card
            className="col-span-full overflow-hidden lg:col-span-3"
            data-reveal
          >
            <CardContent className="grid h-full pt-6 sm:grid-cols-2 sm:gap-6">
              <div className="relative z-10 flex flex-col justify-between">
                <div>
                  <p className="rv-panel-label">Verdict</p>
                  <h3 className="rv-display-sm mt-3 text-balance text-[19px]">
                    The model explains the math. It never does the math.
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-[1.6] text-[var(--ink-muted)]">
                    Buy or wait is written from the finished statistics alone.
                    The raw price history is never in the prompt, so there is no
                    trend left for it to invent.
                  </p>
                </div>
                <p className="mt-5 text-[13px] leading-[1.55] text-[var(--ink-muted)]">
                  Cached against the price check that produced it, so it is
                  rewritten when the price moves, not when the page loads.
                </p>
              </div>

              {/* What reaches the model, and what deliberately does not. */}
              <div className="mt-6 self-center sm:mt-0">
                <ul className="space-y-2">
                  <li className="rounded-[var(--r-sm)] border border-[var(--rule)] bg-[var(--paper-soft)] px-3 py-2.5">
                    <span className="rv-num block text-[12px] text-[var(--ink-fade)]">
                      price_points
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-[var(--ink-muted)]">
                      Never sent
                    </span>
                  </li>
                  <li className="rounded-[var(--r-sm)] border border-[var(--rule)] bg-[var(--paper-pale)] px-3 py-2.5">
                    <span className="rv-num block text-[12px] text-[var(--ink)]">
                      dealmath.py
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-[var(--ink-muted)]">
                      Computes PriceStats
                    </span>
                  </li>
                  <li className="rounded-[var(--r-sm)] border border-[var(--rule)] bg-[var(--paper-pale)] px-3 py-2.5">
                    <span className="rv-num block text-[12px] text-[var(--ink)]">
                      PriceStats
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-[var(--ink-muted)]">
                      The only input to the verdict
                    </span>
                  </li>
                </ul>
                <div className="mt-3">
                  <Stamp tone="quiet">Statistics in, sentence out</Stamp>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5 - Alert rules. Describes the rule engine only: delivery is
                 console-backed today, so nothing here promises a message. */}
          <Card
            className="col-span-full overflow-hidden lg:col-span-3"
            data-reveal
          >
            <CardContent className="grid h-full pt-6 sm:grid-cols-2 sm:gap-6">
              <div className="relative z-10 flex flex-col justify-between">
                <div>
                  <p className="rv-panel-label">Alerts</p>
                  <h3 className="rv-display-sm mt-3 text-[19px]">
                    Set the rule. It fires once.
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-[1.6] text-[var(--ink-muted)]">
                    Three ways to say what counts as a move worth knowing about.
                    You can set one without an account.
                  </p>
                </div>
                <p className="mt-5 text-[13px] leading-[1.55] text-[var(--ink-muted)]">
                  A rule fires at most once per recorded check, held by a
                  database constraint rather than a retry guard, so a price
                  bouncing between two values cannot fire it twice.
                </p>
              </div>

              <ul className="mt-6 self-center border-t border-[var(--rule)] sm:mt-0">
                {RULES.map(([rule, label]) => (
                  <li key={rule} className="border-b border-[var(--rule)] py-3">
                    <span className="rv-num block text-[12px] text-[var(--ink-fade)]">
                      {rule}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] text-[var(--ink)]">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

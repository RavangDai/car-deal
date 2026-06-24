import { useEffect } from "react";
import { FONT_IMPORT, THEME_TOKENS } from "./theme";

export type LegalKind = "terms" | "privacy";

const LAST_UPDATED = "May 24, 2026";
const CONTACT_EMAIL = "support@revveal.app";

interface Props {
  kind: LegalKind;
  onBack: () => void;
}

export default function LegalPage({ kind, onBack }: Props) {
  const doc = kind === "terms" ? TERMS : PRIVACY;
  const other: LegalKind = kind === "terms" ? "privacy" : "terms";

  // Start at the top whenever the document changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [kind]);

  return (
    <div className="rv-legal min-h-screen">
      <style>{STYLES}</style>

      <nav className="rv-legal-nav">
        <div className="rv-legal-nav-inner">
          <button onClick={onBack} className="rv-legal-back">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back to home</span>
          </button>
          <Wordmark />
        </div>
      </nav>

      <main className="rv-legal-main">
        <header className="rv-legal-head">
          <span className="rv-legal-eyebrow">Legal</span>
          <h1 className="rv-display rv-legal-title">{doc.title}</h1>
          <p className="rv-legal-meta">Last updated · {LAST_UPDATED}</p>
          <p className="rv-legal-intro">{doc.intro}</p>
        </header>

        <article className="rv-legal-body">
          {doc.sections.map((s, i) => (
            <section key={s.h} className="rv-legal-section">
              <h2 className="rv-display rv-legal-h2">
                <span className="rv-legal-h2-num">{String(i + 1).padStart(2, "0")}</span>
                {s.h}
              </h2>
              {s.body?.map((p, j) => (
                <p key={j} className="rv-legal-p">{p}</p>
              ))}
              {s.bullets && (
                <ul className="rv-legal-list">
                  {s.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <footer className="rv-legal-foot">
          <p className="rv-legal-foot-line">
            Questions? Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
          <div className="rv-legal-foot-links">
            <a href={`#/${other}`} className="rv-legal-foot-link">
              Read our {other === "terms" ? "Terms of Service" : "Privacy Policy"} →
            </a>
            <button onClick={onBack} className="rv-legal-foot-link rv-legal-foot-link-btn">Back to home</button>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ── COMPONENTS ───────────────────────────────────────────── */

function Wordmark() {
  return (
    <span className="rv-legal-wordmark">
      <span className="rv-legal-wordmark-mark">
        <img src="/revveal-logo.png" alt="Revveal" className="rv-legal-wordmark-img" />
      </span>
      <span className="rv-legal-wordmark-name">Revveal</span>
    </span>
  );
}

/* ── CONTENT ──────────────────────────────────────────────── */

type Section = { h: string; body?: string[]; bullets?: string[] };
type Doc = { title: string; intro: string; sections: Section[] };

const TERMS: Doc = {
  title: "Terms of Service",
  intro:
    "These Terms of Service (the “Terms”) govern your access to and use of Revveal (the “Service”). By creating an account, browsing as a guest, or otherwise using the Service, you agree to these Terms. If you do not agree, please do not use the Service.",
  sections: [
    {
      h: "Acceptance of the Terms",
      body: [
        "By accessing or using the Service you confirm that you have read, understood, and agree to be bound by these Terms and by our Privacy Policy, which is incorporated here by reference. We may update these Terms from time to time; the “Last updated” date above reflects the most recent revision, and your continued use after a change means you accept the revised Terms.",
      ],
    },
    {
      h: "What Revveal Is",
      body: [
        "Revveal aggregates publicly available used-car listings from third-party marketplaces and dealer feeds, estimates a fair-market price for each vehicle, and ranks listings by how far below that estimate they are priced. The Service is an informational tool only. We are not a dealer, broker, marketplace, lender, or party to any vehicle transaction.",
      ],
    },
    {
      h: "Eligibility and Accounts",
      body: [
        "You must be at least 18 years old to create an account. You agree to provide accurate information, to keep your login credentials confidential, and to be responsible for all activity under your account. Notify us promptly at the contact address below if you suspect unauthorized use. You may browse limited features as a guest without an account.",
      ],
    },
    {
      h: "Acceptable Use",
      body: ["You agree not to:"],
      bullets: [
        "Scrape, crawl, copy, or harvest data from the Service, or resell or redistribute its content.",
        "Use bots, scripts, or other automated means to access the Service or circumvent rate limits.",
        "Reverse engineer, decompile, or attempt to extract the source code of the Service.",
        "Interfere with, disrupt, or place undue load on the Service or its infrastructure.",
        "Use the Service for any unlawful, infringing, or fraudulent purpose.",
      ],
    },
    {
      h: "Listings and Third-Party Data",
      body: [
        "Listing details, prices, photos, vehicle history signals, and seller information are supplied by third parties and are not created, owned, or independently verified by Revveal. Fair-market estimates and discount percentages are generated by automated models and may be inaccurate or out of date.",
        "You are solely responsible for independently verifying any listing before acting on it, including inspecting the vehicle, confirming its title and history, and reviewing the actual terms offered by the seller. Revveal is not responsible for the accuracy of third-party data or for any transaction you enter into with a seller.",
      ],
    },
    {
      h: "No Professional Advice",
      body: [
        "The Service does not provide financial, legal, tax, or professional purchasing advice. Estimates and rankings are provided for general informational purposes and should not be relied upon as the sole basis for any purchase decision.",
      ],
    },
    {
      h: "Donations",
      body: [
        "Donations are entirely voluntary and are processed by our payment provider, Stripe. You receive no goods, services, or membership benefits in exchange for a donation. Because donations are gifts rather than purchases, they are non-refundable except where required by law. We do not receive or store your full payment card details.",
      ],
    },
    {
      h: "Intellectual Property",
      body: [
        "The Service, including its software, design, text, and the Revveal name and logo, is owned by Revveal or its licensors and is protected by intellectual-property laws. We grant you a limited, non-exclusive, non-transferable, revocable license to use the Service for your personal, non-commercial use, subject to these Terms.",
      ],
    },
    {
      h: "Disclaimers",
      body: [
        "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted, error-free, or that any estimate or listing is accurate or available.",
      ],
    },
    {
      h: "Limitation of Liability",
      body: [
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, REVVEAL AND ITS OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS arising out of or relating to your use of the Service, even if advised of the possibility of such damages. Our total liability for any claim relating to the Service will not exceed one hundred U.S. dollars (US$100).",
      ],
    },
    {
      h: "Indemnification",
      body: [
        "You agree to indemnify and hold harmless Revveal and its operators from any claims, damages, liabilities, and expenses (including reasonable legal fees) arising out of your use of the Service, your violation of these Terms, or your infringement of any rights of a third party.",
      ],
    },
    {
      h: "Termination",
      body: [
        "We may suspend or terminate your access to the Service at any time, with or without notice, if we believe you have violated these Terms or to protect the Service. You may stop using the Service and delete your account at any time. Sections that by their nature should survive termination will survive.",
      ],
    },
    {
      h: "Governing Law",
      body: [
        "These Terms are governed by the laws of the State of California, United States, without regard to its conflict-of-laws rules. You agree to the exclusive jurisdiction of the state and federal courts located in California for any dispute that is not subject to arbitration or a small-claims forum.",
      ],
    },
    {
      h: "Contact",
      body: [
        `If you have questions about these Terms, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

const PRIVACY: Doc = {
  title: "Privacy Policy",
  intro:
    "This Privacy Policy explains what information Revveal (“we,” “us”) collects, how we use it, and the choices you have. It applies to your use of the Revveal website and services.",
  sections: [
    {
      h: "Information We Collect",
      body: ["We collect the following categories of information:"],
      bullets: [
        "Account information you provide — your email address and a securely hashed version of your password.",
        "Usage information — the searches you run, listings you save, filters you set, and similar activity.",
        "Technical information — IP address, browser and device type, and server log data, used for security and diagnostics.",
        "Local storage — we store your session token, guest-mode flag, and preferences in your browser’s local storage.",
        "We do NOT collect or store your payment card details. Donations are processed by Stripe, which handles your card information under its own privacy policy.",
      ],
    },
    {
      h: "How We Use Your Information",
      body: ["We use the information we collect to:"],
      bullets: [
        "Provide, operate, and maintain the Service and your account.",
        "Authenticate you and keep your account secure.",
        "Send alerts and notifications you have requested.",
        "Analyze usage to improve and develop the Service.",
        "Detect, prevent, and address abuse, fraud, and security issues.",
        "Comply with legal obligations and enforce our Terms.",
      ],
    },
    {
      h: "Cookies and Local Storage",
      body: [
        "We use your browser’s local storage to keep you signed in and to remember preferences. We do not use third-party advertising or cross-site tracking cookies. You can clear this data at any time through your browser settings, though doing so will sign you out.",
      ],
    },
    {
      h: "Third-Party Services",
      body: [
        "We rely on a small number of third-party providers to operate the Service, including Stripe for donation processing and hosting and infrastructure providers. Listing data is sourced from third-party marketplaces and dealer feeds. These third parties process information under their own privacy policies.",
      ],
    },
    {
      h: "How We Share Information",
      body: [
        "We do not sell your personal information. We share information only with service providers who process it on our behalf under confidentiality obligations, when required by law or valid legal process, to protect the rights and safety of Revveal and its users, or in connection with a merger, acquisition, or sale of assets.",
      ],
    },
    {
      h: "Data Retention",
      body: [
        "We retain your account information for as long as your account is active. If you delete your account or ask us to delete your data, we will remove your personal information within a reasonable period, except where we are required to retain it to comply with legal obligations or resolve disputes.",
      ],
    },
    {
      h: "Security",
      body: [
        "We protect your information using industry-standard measures, including bcrypt password hashing, signed access tokens, and encryption of data in transit. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.",
      ],
    },
    {
      h: "Your Rights",
      body: [
        "Depending on where you live, you may have the right to access, correct, export, or delete your personal information, and to object to or restrict certain processing. Residents of the EEA/UK (GDPR) and California (CCPA/CPRA) have specific rights. To exercise any of these rights, contact us at the address below and we will respond as required by applicable law.",
      ],
    },
    {
      h: "Children’s Privacy",
      body: [
        "The Service is not directed to children under 16, and we do not knowingly collect personal information from them. If you believe a child has provided us with personal information, please contact us and we will delete it.",
      ],
    },
    {
      h: "International Users",
      body: [
        "We operate the Service from the United States. If you access it from outside the U.S., you understand that your information may be transferred to, stored, and processed in the United States, where data-protection laws may differ from those in your country.",
      ],
    },
    {
      h: "Changes to This Policy",
      body: [
        "We may update this Privacy Policy from time to time. When we do, we will revise the “Last updated” date above and, where appropriate, provide additional notice. Your continued use of the Service after a change means you accept the updated policy.",
      ],
    },
    {
      h: "Contact Us",
      body: [
        `If you have questions about this Privacy Policy or your data, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

/* ── STYLES ───────────────────────────────────────────────── */

const STYLES = `
  ${FONT_IMPORT}

  .rv-legal {
    ${THEME_TOKENS}

    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .rv-legal .rv-display { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; text-wrap: balance; font-optical-sizing: auto; }

  /* Nav */
  .rv-legal .rv-legal-nav {
    position: sticky; top: 0; z-index: 20;
    background: rgba(255,253,250,0.82);
    backdrop-filter: saturate(180%) blur(10px);
    -webkit-backdrop-filter: saturate(180%) blur(10px);
    border-bottom: 1px solid var(--rule);
    box-shadow: var(--shadow-sm);
  }
  .rv-legal .rv-legal-nav-inner {
    max-width: 760px; margin: 0 auto;
    padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px;
  }
  .rv-legal .rv-legal-back {
    display: inline-flex; align-items: center; gap: 7px;
    background: transparent; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600; color: var(--ink-muted);
    transition: color 0.15s ease;
  }
  .rv-legal .rv-legal-back:hover { color: var(--ink); }
  .rv-legal .rv-legal-back svg { transition: transform 0.25s cubic-bezier(0.16,1,0.3,1); }
  .rv-legal .rv-legal-back:hover svg { transform: translateX(-3px); }
  .rv-legal .rv-legal-wordmark { display: inline-flex; align-items: center; gap: 9px; color: var(--ink); }
  .rv-legal .rv-legal-wordmark-mark { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; }
  .rv-legal .rv-legal-wordmark-img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .rv-legal .rv-legal-wordmark-name { font-weight: 800; font-size: 19px; letter-spacing: -0.02em; line-height: 1; }

  /* Main column */
  .rv-legal .rv-legal-main {
    max-width: 720px; margin: 0 auto;
    padding: 56px 24px 96px;
  }

  .rv-legal .rv-legal-head { margin-bottom: 40px; }
  .rv-legal .rv-legal-eyebrow {
    display: inline-block;
    font-size: 11.5px; letter-spacing: 0.1em; text-transform: uppercase;
    font-weight: 600; color: var(--red);
    margin-bottom: 14px;
  }
  .rv-legal .rv-legal-title {
    font-size: clamp(2.2rem, 5vw, 3rem);
    line-height: 1.04;
    margin: 0 0 12px;
  }
  .rv-legal .rv-legal-meta {
    font-size: 12.5px; letter-spacing: 0.04em;
    color: var(--ink-fade);
    margin: 0 0 22px;
  }
  .rv-legal .rv-legal-intro {
    font-size: 16.5px; line-height: 1.6;
    color: var(--ink-muted);
    margin: 0;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--rule);
    max-width: 68ch;
  }

  .rv-legal .rv-legal-section { margin-bottom: 32px; }
  .rv-legal .rv-legal-h2 {
    display: flex; align-items: baseline; gap: 12px;
    font-size: 1.3rem; line-height: 1.2;
    margin: 0 0 12px;
  }
  .rv-legal .rv-legal-h2-num {
    font-size: 13px; font-weight: 800;
    color: var(--red);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .rv-legal .rv-legal-p {
    font-size: 15.5px; line-height: 1.65;
    color: var(--ink-muted);
    margin: 0 0 12px;
    max-width: 68ch;
    text-wrap: pretty;
  }
  .rv-legal .rv-legal-list {
    margin: 4px 0 12px;
    padding-left: 0;
    list-style: none;
    max-width: 68ch;
  }
  .rv-legal .rv-legal-list li {
    position: relative;
    padding-left: 20px;
    font-size: 15px; line-height: 1.6;
    color: var(--ink-muted);
    margin-bottom: 8px;
  }
  .rv-legal .rv-legal-list li::before {
    content: "—";
    position: absolute; left: 0;
    color: var(--red);
  }

  .rv-legal .rv-legal-foot {
    margin-top: 44px;
    padding-top: 26px;
    border-top: 1px solid var(--rule);
  }
  .rv-legal .rv-legal-foot-line {
    font-size: 15px; color: var(--ink-muted); margin: 0 0 18px;
  }
  .rv-legal .rv-legal-foot a,
  .rv-legal .rv-legal-foot-line a {
    color: var(--link);
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color .15s ease;
  }
  .rv-legal .rv-legal-foot a:hover,
  .rv-legal .rv-legal-foot-line a:hover { color: var(--link-hover); }
  .rv-legal .rv-legal-foot-links {
    display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
  }
  .rv-legal .rv-legal-foot-link {
    font-size: 13.5px; font-weight: 600; color: var(--ink);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .rv-legal .rv-legal-foot-link:hover { color: var(--link); }
  .rv-legal .rv-legal-foot-link-btn { background: transparent; border: none; cursor: pointer; }

  @media (max-width: 600px) {
    .rv-legal .rv-legal-main { padding: 40px 20px 72px; }
  }
`;

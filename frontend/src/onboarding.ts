// frontend/src/onboarding.ts
// Onboarding answers: their shape, their localStorage home, and the rule for
// getting a guest's answers onto their account once they make one.
//
// Guests have no server identity at all — the guest flag is a localStorage
// boolean (see api.ts) and every authed endpoint 401s for them by design. So
// their answers live here until an account exists, at which point
// flushLocalOnboarding() PUTs them once. That flush runs after ANY successful
// authentication (register, password login, OAuth return) rather than being
// merged server-side in register + the OAuth create branch, because one
// client-side call covers all three paths and cannot drift between them.
import { useCallback, useState } from "react";
import { saveOnboarding, type OnboardingPrefs } from "./api";
import { isCategorySlug, type CategorySlug } from "./taxonomy";

export type Sensitivity = "any" | "strong" | "lowest";
export type Cadence = "instant" | "daily" | "weekly" | "off";

export type OnboardingAnswers = {
  version: number;
  completed_at: string | null;
  categories: CategorySlug[];
  budget_min: number | null;
  budget_max: number | null;
  sensitivity: Sensitivity;
  alert_cadence: Cadence;
};

export const DEFAULT_ANSWERS: OnboardingAnswers = {
  version: 1,
  completed_at: null,
  categories: [],
  budget_min: null,
  budget_max: null,
  sensitivity: "strong",
  alert_cadence: "daily",
};

// Mirrors SENSITIVITY_MIN_SCORE in backend/app/preferences_api.py. Duplicated
// so a guest — who never calls the API — still gets a filtered feed.
export const SENSITIVITY_MIN_SCORE: Record<Sensitivity, number> = {
  any: 0,
  strong: 55,
  lowest: 75,
};

const KEY = "wic:onboarding";
const SEEN_KEY = "wic:onboarding-seen";

function coerce(parsed: Partial<OnboardingAnswers> | null): OnboardingAnswers {
  if (!parsed || typeof parsed !== "object") return DEFAULT_ANSWERS;
  const sens = parsed.sensitivity;
  const cad = parsed.alert_cadence;
  return {
    version: 1,
    completed_at: typeof parsed.completed_at === "string" ? parsed.completed_at : null,
    // Filter rather than reject: a slug left over from an older taxonomy must
    // not make the whole stored profile unreadable.
    categories: Array.isArray(parsed.categories)
      ? (parsed.categories.filter(
          (c): c is CategorySlug => typeof c === "string" && isCategorySlug(c),
        ) as CategorySlug[])
      : [],
    budget_min: typeof parsed.budget_min === "number" ? parsed.budget_min : null,
    budget_max: typeof parsed.budget_max === "number" ? parsed.budget_max : null,
    sensitivity:
      sens === "any" || sens === "strong" || sens === "lowest" ? sens : "strong",
    alert_cadence:
      cad === "instant" || cad === "daily" || cad === "weekly" || cad === "off"
        ? cad
        : "daily",
  };
}

export function readLocalOnboarding(): OnboardingAnswers {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ANSWERS;
    return coerce(JSON.parse(raw) as Partial<OnboardingAnswers>);
  } catch {
    // Private mode, disabled storage, corrupt JSON — never block onboarding
    // over a preference read.
    return DEFAULT_ANSWERS;
  }
}

export function writeLocalOnboarding(answers: OnboardingAnswers) {
  try {
    localStorage.setItem(KEY, JSON.stringify(answers));
  } catch {
    // Answers just won't survive a reload; the session still honours them.
  }
}

/** True once the flow has been completed OR explicitly dismissed. */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // If storage is unavailable we cannot remember a dismissal, and showing
    // the flow on every visit would be worse than never showing it.
    return true;
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* nothing to do */
  }
}

export function toPayload(answers: OnboardingAnswers): OnboardingPrefs {
  return {
    version: 1,
    completed_at: answers.completed_at,
    categories: answers.categories,
    budget_min: answers.budget_min,
    budget_max: answers.budget_max,
    sensitivity: answers.sensitivity,
    alert_cadence: answers.alert_cadence,
  };
}

/**
 * Push locally-held answers onto the freshly-authenticated account.
 *
 * Called after every successful auth. Silent on failure: a preference that
 * did not sync must never block someone from getting into the app, and the
 * answers stay in localStorage for the next attempt.
 */
export async function flushLocalOnboarding(): Promise<void> {
  const answers = readLocalOnboarding();
  if (answers.completed_at === null && answers.categories.length === 0) return;
  try {
    await saveOnboarding(toPayload(answers));
  } catch {
    /* keep the local copy; try again after the next sign-in */
  }
}

/** Normalize an API payload back into local answer shape. */
export function fromPayload(prefs: OnboardingPrefs): OnboardingAnswers {
  return coerce(prefs as unknown as Partial<OnboardingAnswers>);
}

export function useLocalOnboarding(initial?: OnboardingAnswers) {
  // `initial` wins when supplied: a signed-in user's server profile is the
  // authority over whatever this browser happens to have cached.
  const [answers, setAnswers] = useState<OnboardingAnswers>(
    () => initial ?? readLocalOnboarding(),
  );

  const update = useCallback((patch: Partial<OnboardingAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      writeLocalOnboarding(next);
      return next;
    });
  }, []);

  return { answers, update };
}

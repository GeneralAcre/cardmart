"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Pointer, X, Zap } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { completeTours } from "@/lib/tour-actions";
import { TOURS, TOUR_TIERS, isTourId, tourXp, type TourId, type TourStep } from "@/lib/tours";

// Tours finished or skipped in this browser. Guests can only keep them here;
// once signed in, finished ones are copied to their account (and XP) the next
// time any tour component loads.
const STORAGE_KEY = "cardmart-tours";
interface StoredTours {
  done: string[];
  skipped: string[];
  /** Finished as a guest: the steps only signed-in users get (see LOGGED_IN) are still to show. */
  asGuest: string[];
}

function readStored(): StoredTours {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      done: Array.isArray(parsed.done) ? parsed.done : [],
      skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
      asGuest: Array.isArray(parsed.asGuest) ? parsed.asGuest : [],
    };
  } catch {
    return { done: [], skipped: [], asGuest: [] };
  }
}

function remember(id: TourId, as: keyof StoredTours, keep = true) {
  const stored = readStored();
  stored[as] = stored[as].filter((d) => d !== id);
  if (keep) stored[as].push(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Private mode or full storage: the tour may just show again next time.
  }
}

// A tour paused on a "tap here" step (TourStep.opens): the tour it opened on
// the next page, and where to carry on once that's over. Kept for this tab
// only; the paused tour picks it up when its page is next opened.
const RESUME_KEY = "cardmart-tour-resume";
interface Resume {
  tour: TourId;
  /** The target of the step that was tapped; the tour goes on from the one after. */
  after: string;
  returnTo: string;
  /** The tour that runs on the page they went to, until it's been shown. */
  opens: TourId | null;
  /** It was the signed-in follow-up (LOGGED_IN), not the whole tour. */
  loggedIn: boolean;
}

// Someone who finished a tour as a guest, then signed in, gets just the steps
// they couldn't do before (TourStep.opens: Sell a card, the indexes), once,
// after this card.
const LOGGED_IN: TourStep = {
  title: "You're logged in",
  body: "Now you can open the parts that need an account. Tap each one to see how it works.",
};

function loggedInSteps(id: TourId): TourStep[] {
  const steps = TOURS[id].filter((step: TourStep) => step.opens);
  return steps.length > 0 ? [LOGGED_IN, ...steps] : [];
}

function readResume(): Resume | null {
  try {
    return JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? "null");
  } catch {
    return null;
  }
}

function writeResume(resume: Resume | null) {
  try {
    if (resume) sessionStorage.setItem(RESUME_KEY, JSON.stringify(resume));
    else sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // Storage blocked: the paused tour just won't carry on.
  }
}

/** The first element with this data-tour value that's actually showing at this screen size. */
function findTarget(target: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

const PAD = 8; // space around the spotlit element
const GAP = 12; // between the spotlight and the card
const EDGE = 12; // keep the card this far from the screen edges

export function TourGuide({ id, signedIn, done }: { id: TourId; signedIn: boolean; done: string[] }) {
  const t = useT();
  const router = useRouter();
  // Where to go back to when this tour was opened from a step of another one.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  // Showing only the signed-in follow-up of a tour finished as a guest.
  const [loggedIn, setLoggedIn] = useState(false);
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  // The spotlit element's box, and its data-tour-skip reason if it has one.
  const [tracked, setTracked] = useState<{ step: TourStep; rect: DOMRect; skip: string | undefined } | null>(null);
  // Hidden while they try the feature they tapped (a dialog or a file picker).
  const [paused, setPaused] = useState(false);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Decide whether to start: not if it's finished (on the account or in this
  // browser) or skipped, unless the address asks for it (?tour, the Rewards
  // task's Go link). Signed in, carry over tours finished as a guest.
  useEffect(() => {
    const stored = readStored();
    if (signedIn) {
      const pending = stored.done.filter((d) => isTourId(d) && !done.includes(d));
      if (pending.length > 0) {
        completeTours(pending).then((result) => {
          if (result.xpGained > 0) toast.success(t("Your finished tours were added: +{xp} XP", { xp: result.xpGained }));
        });
      }
    }
    // Back from the page a step opened: carry on after that step. Or this
    // is that page, opened from the step: run its tour even if seen before.
    const resume = readResume();
    const resuming = resume?.tour === id && resume.returnTo === window.location.pathname ? resume : null;
    const opened = resume?.opens === id ? resume : null;
    if (resuming) writeResume(null);
    if (opened) writeResume({ ...opened, opens: null });

    const forced = new URLSearchParams(window.location.search).has("tour");
    const seen = done.includes(id) || stored.done.includes(id) || stored.skipped.includes(id);
    const followUp = resuming
      ? resuming.loggedIn
      : signedIn && !forced && !opened && stored.asGuest.includes(id) && loggedInSteps(id).length > 0;
    if (seen && !forced && !resuming && !opened && !followUp) return;

    // Give the page a moment to lay out (images, charts) before measuring.
    const timer = window.setTimeout(() => {
      const all = followUp ? loggedInSteps(id) : TOURS[id];
      const shown = all.filter((step: TourStep) => !step.target || findTarget(step.target));
      if (shown.length === 0) return;
      if (resuming) {
        const at = shown.findIndex((step) => step.target === resuming.after) + 1;
        // The tapped step was the last one: that's the end of the follow-up.
        if (at >= shown.length) {
          remember(id, "asGuest", false);
          return;
        }
        setIndex(Math.max(at, 0));
      }
      setLoggedIn(followUp);
      setReturnTo(opened?.returnTo ?? null);
      setSteps(shown);
    }, 700);
    return () => window.clearTimeout(timer);
    // Runs once per page: `done` comes from the server render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const step = steps?.[index];
  const open = step != null;
  const rect = tracked && tracked.step === step ? tracked.rect : null;
  // A signed-in user has to tap the spotlit feature to go on (guests can't use
  // these yet). The page can let them skip it with a reason, as data-tour-skip
  // on the element: no card to auction yet, a photo already added.
  const mustTap = signedIn && step?.tap != null && step.target != null && rect != null;
  const skipReason = mustTap ? tracked?.skip : undefined;
  const stuck = mustTap && !skipReason;

  // Bring the step's element into view, then follow it while the page moves.
  useEffect(() => {
    if (!step) return;
    const el = step.target ? findTarget(step.target) : null;
    if (!el) return;
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.5;
    el.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "center" });
    let frame = 0;
    const follow = () => {
      const next = el.getBoundingClientRect();
      const skip = el.dataset.tourSkip;
      setTracked((prev) =>
        prev?.step === step &&
        prev.skip === skip &&
        prev.rect.top === next.top &&
        prev.rect.left === next.left &&
        prev.rect.width === next.width &&
        prev.rect.height === next.height
          ? prev
          : { step, rect: next, skip },
      );
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // Tapping the spotlit feature. A link to another page (TourStep.opens)
  // pauses this tour there: that page's tour takes over and sends them back
  // here after. Anything else opens right here, so step aside while they try it.
  useEffect(() => {
    if (!mustTap || !step?.target) return;
    const el = findTarget(step.target);
    if (!el) return;
    const { target, opens } = step;
    const onClick = (e: MouseEvent) => {
      if (opens) {
        if (!(e.target instanceof Element) || !e.target.closest("a[href]")) return;
        writeResume({ tour: id, after: target, returnTo: window.location.pathname, opens, loggedIn });
        setSteps(null);
        setCardPos(null);
        return;
      }
      setPaused(true);
    };
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);
  }, [mustTap, step, id, loggedIn]);

  // Place the card below the spotlight if it fits, else above, else over the
  // bottom of the screen; centred when there's nothing to point at.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!open || !card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { width: cw, height: ch } = card.getBoundingClientRect();
    if (!rect) {
      setCardPos({ top: (vh - ch) / 2, left: (vw - cw) / 2 });
      return;
    }
    const left = Math.min(Math.max(rect.left + rect.width / 2 - cw / 2, EDGE), vw - cw - EDGE);
    const below = rect.bottom + PAD + GAP;
    const above = rect.top - PAD - GAP - ch;
    let top: number;
    if (below + ch <= vh - EDGE) top = below;
    else if (above >= EDGE) top = above;
    else top = vh - ch - EDGE - (vw < 768 ? 56 : 0); // clear the phone's bottom menu
    setCardPos({ top, left });
  }, [open, rect, index]);

  const close = useCallback(
    (finished: boolean) => {
      setSteps(null);
      setIndex(0);
      setCardPos(null);
      // The follow-up only adds to a tour already counted: just don't show it again.
      if (loggedIn) {
        remember(id, "asGuest", false);
        return;
      }
      remember(id, finished ? "done" : "skipped");
      // Opened from another tour: finishing goes back to it, where it carries on.
      if (finished && returnTo) router.push(returnTo);
      if (!finished) return;
      if (!signedIn) {
        remember(id, "asGuest");
        toast.success(t("Tour done! Log in to collect your XP."));
        return;
      }
      completeTours([id]).then((result) => {
        if (result.xpGained > 0) toast.success(t("Tour done: +{xp} XP", { xp: result.xpGained }));
        else toast.success(t("Tour done"));
      });
    },
    [id, signedIn, t, returnTo, router, loggedIn],
  );

  const last = steps != null && index === steps.length - 1;
  const next = useCallback(() => (last ? close(true) : setIndex((i) => i + 1)), [last, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Carry on once they're done trying it: no dialog open any more and the
  // window has focus back (a file picker takes it away while it's open).
  useEffect(() => {
    if (!paused) return;
    const since = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - since < 800 || !document.hasFocus()) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      window.clearInterval(timer);
      setPaused(false);
      next();
    }, 300);
    return () => window.clearInterval(timer);
  }, [paused, next]);

  useEffect(() => {
    if (!open || paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      else if ((e.key === "ArrowRight" || e.key === "Enter") && !stuck) next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, paused, stuck, close, next, back]);

  if (!open || !steps || paused) return null;

  // XP the finish would add, if it reaches a new step of the tour task.
  const count = done.length + (done.includes(id) ? 0 : 1);
  const reward = signedIn && !done.includes(id) ? tourXp(count) - tourXp(done.length) : TOUR_TIERS[0].xp;

  return createPortal(
    // The frame itself lets clicks through; only the dimmed blocker and the card take them,
    // so the cut-out spotlight on a step they have to try really can be tapped.
    <div className="pointer-events-none fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t(step.title)}>
      {/* Blocks the page while touring; the spotlight's huge shadow does the dimming. */}
      {/* On a step they have to try, the spotlight is cut out of it so it can be tapped. */}
      <div
        className={cn("pointer-events-auto absolute inset-0", !rect && "bg-black/60")}
        style={
          mustTap && rect
            ? {
                clipPath: `path(evenodd, "M0 0H${window.innerWidth}V${window.innerHeight}H0Z M${rect.left - PAD} ${rect.top - PAD}h${rect.width + PAD * 2}v${rect.height + PAD * 2}h${-(rect.width + PAD * 2)}Z")`,
              }
            : undefined
        }
      />
      {rect && (
        <div
          className={cn(
            "pointer-events-none absolute rounded-2xl ring-2 transition-all duration-300 ease-out",
            mustTap ? "ring-success" : "ring-white/80",
          )}
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          }}
        />
      )}
      <div
        ref={cardRef}
        className={cn(
          "bg-popover text-popover-foreground pointer-events-auto absolute flex w-[min(22rem,calc(100vw-24px))] flex-col gap-3 rounded-2xl border p-5 shadow-2xl transition-[top,left,opacity] duration-300 ease-out",
          !cardPos && "opacity-0",
        )}
        style={cardPos ?? { top: 0, left: 0 }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {t("{n} of {total}", { n: index + 1, total: steps.length })}
          </span>
          <button
            type="button"
            onClick={() => close(false)}
            aria-label={t("Skip tour")}
            className="text-muted-foreground hover:text-foreground -m-1 rounded-full p-1"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold">{t(step.title)}</h2>
          <p className="text-muted-foreground text-sm">{t(step.body)}</p>
        </div>
        {mustTap && step.tap && (
          <p className="bg-success/15 text-success flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium">
            <Pointer className="size-4 shrink-0" />
            {t(step.tap)}
          </p>
        )}
        {skipReason && <p className="text-muted-foreground text-xs">{t(skipReason)}</p>}
        <div className="flex items-center gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 rounded-full transition-all", i === index ? "bg-foreground w-5" : "bg-muted-foreground/30 w-1.5")}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          {index > 0 ? (
            <button
              type="button"
              onClick={back}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium"
            >
              <ArrowLeft className="size-4" />
              {t("Back")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => close(false)}
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              {t("Skip")}
            </button>
          )}
          {mustTap ? (
            // Only when the page says they can't or needn't try it.
            skipReason && (
              <button type="button" onClick={next} className="text-muted-foreground hover:text-foreground text-sm font-medium">
                {t("Skip this part")}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={next}
              autoFocus
              className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
            >
              {last ? (
                <>
                  {returnTo ? t("Continue the tour") : t("Finish")}
                  {reward > 0 && !loggedIn && (
                    <span className="bg-success-fill text-success-fill-foreground flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold">
                      <Zap className="size-3" fill="currentColor" />+{reward} XP
                    </span>
                  )}
                </>
              ) : (
                <>
                  {t("Next")}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

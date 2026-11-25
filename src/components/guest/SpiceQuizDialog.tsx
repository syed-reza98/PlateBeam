'use client';

import { useState } from 'react';
import { Award, CheckCircle2, Flame, Trophy } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import type { GuestLeaderboardEntry } from './types';

interface SpiceQuizDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  playerNickname: string;
  leaderboard: GuestLeaderboardEntry[];
  onScoreSubmitted: (entry: GuestLeaderboardEntry) => void;
}

const QUESTIONS = [
  {
    q: 'Which chili pepper is measured around 50,000 Scoville Heat Units?',
    options: ['Jalapeño', 'Cayenne', 'Habanero', 'Poblano'],
    answerIndex: 1,
  },
  {
    q: 'What spice gives traditional butter chicken its warm golden-red hue?',
    options: ['Star Anise', 'Kashmiri Red Chili', 'Cardamom', 'Caraway'],
    answerIndex: 1,
  },
  {
    q: 'Which aromatic seed is the key cooling finish in many Indian biryanis?',
    options: ['Green Cardamom', 'Mustard Seed', 'Fenugreek', 'Sumac'],
    answerIndex: 0,
  },
  {
    q: 'What compound in chili peppers triggers the sensation of heat?',
    options: ['Piperine', 'Capsaicin', 'Curcumin', 'Eugenol'],
    answerIndex: 1,
  },
  {
    q: 'Which spice is harvested from the dried stigmas of Crocus sativus?',
    options: ['Turmeric', 'Annatto', 'Saffron', 'Paprika'],
    answerIndex: 2,
  },
];

export function SpiceQuizDialog({
  open,
  onClose,
  sessionId,
  playerNickname,
  leaderboard,
  onScoreSubmitted,
}: SpiceQuizDialogProps) {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  const currentQ = QUESTIONS[step];

  const handleSelectOption = async (idx: number) => {
    if (selectedIdx !== null || !currentQ) return;
    setSelectedIdx(idx);
    const earned = idx === currentQ.answerIndex ? 100 : 0;
    const nextScore = score + earned;
    setScore(nextScore);

    setTimeout(async () => {
      if (step + 1 < QUESTIONS.length) {
        setStep((s) => s + 1);
        setSelectedIdx(null);
      } else {
        setIsFinished(true);
        setSubmitting(true);
        try {
          const res = await fetch(`/api/v1/sessions/${sessionId}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameType: 'SPICE_QUIZ',
              playerNickname,
              score: nextScore,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              rewardCouponCode?: string | null;
              entry?: GuestLeaderboardEntry;
            };
            if (data.rewardCouponCode) setCouponCode(data.rewardCouponCode);
            onScoreSubmitted(
              data.entry ?? {
                playerNickname,
                score: nextScore,
                createdAt: new Date().toISOString(),
                rewardCouponCode: data.rewardCouponCode,
              },
            );
            showToast({
              title: `Spice Quiz complete: ${nextScore} pts`,
              variant: 'success',
            });
          }
        } catch {
          // Offline or API unavailable — still show local score
        } finally {
          setSubmitting(false);
        }
      }
    }, 550);
  };

  const handleRestart = () => {
    setStep(0);
    setScore(0);
    setSelectedIdx(null);
    setIsFinished(false);
    setCouponCode(null);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Spice Quiz Trivia" closedby="any">
      <div className="space-y-5">
        {!isFinished && currentQ ? (
          <>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--pb-muted)]">
              <span className="inline-flex items-center gap-1 text-[var(--pb-accent)]">
                <Flame className="size-4" aria-hidden="true" />
                Question {step + 1} of {QUESTIONS.length}
              </span>
              <span className="font-mono tabular-nums">Score: {score}</span>
            </div>

            <h2 className="font-serif text-xl leading-snug">{currentQ.q}</h2>

            <div className="space-y-2">
              {currentQ.options.map((opt, idx) => {
                const isChosen = selectedIdx === idx;
                const isCorrect = idx === currentQ.answerIndex;
                let style =
                  'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-ink)]';
                if (selectedIdx !== null) {
                  if (isCorrect) {
                    style =
                      'border-[var(--pb-olive)] bg-[var(--pb-olive)]/15 text-[var(--pb-olive)]';
                  } else if (isChosen) {
                    style =
                      'border-[var(--pb-chili)] bg-[var(--pb-chili)]/15 text-[var(--pb-chili)]';
                  }
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={selectedIdx !== null}
                    onClick={() => handleSelectOption(idx)}
                    className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors ${style}`}
                  >
                    <span>{opt}</span>
                    {selectedIdx !== null && isCorrect && (
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-4 text-center">
            <Trophy className="mx-auto size-10 text-[var(--pb-turmeric)]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                Final Score · {playerNickname}
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
                {score} / {QUESTIONS.length * 100}
              </p>
            </div>

            {couponCode && (
              <div className="rounded-xl border border-[var(--pb-olive)] bg-[var(--pb-olive)]/10 p-3 text-sm">
                <p className="flex items-center justify-center gap-1.5 font-semibold text-[var(--pb-olive)]">
                  <Award className="size-4" aria-hidden="true" />
                  High-Score Reward Unlocked!
                </p>
                <p className="mt-1 font-mono text-base font-bold">{couponCode}</p>
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleRestart}
              className="min-h-[44px] w-full rounded-xl bg-[var(--pb-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--pb-accent-ink)]"
            >
              {submitting ? 'Saving Score...' : 'Play Again'}
            </button>
          </div>
        )}

        {/* Daily Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="border-t border-[var(--pb-border)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Today&apos;s Table Leaderboard
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {leaderboard.slice(0, 5).map((entry, idx) => (
                <li
                  key={`${entry.playerNickname}-${idx}`}
                  className="flex items-center justify-between rounded-lg bg-[var(--pb-canvas)] px-3 py-1.5"
                >
                  <span className="font-medium">
                    <span className="font-mono text-xs text-[var(--pb-muted)]">
                      #{idx + 1}{' '}
                    </span>
                    {entry.playerNickname}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    {entry.score} pts
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Dialog>
  );
}

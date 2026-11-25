'use client';

import { useState } from 'react';
import { CheckCircle2, Flame, Trophy, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import type { GuestLeaderboardEntry } from './types';

interface SpiceQuizDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  playerNickname: string;
  tableNumber?: string | null;
  leaderboard: GuestLeaderboardEntry[];
  onScoreSubmitted: (entry: GuestLeaderboardEntry) => void;
}

const QUESTIONS = [
  {
    q: 'Which chili pepper is measured around 50,000 Scoville Heat Units?',
    options: ['Jalapeño', 'Cayenne', 'Habanero', 'Poblano'],
    answerIndex: 1,
    fact: 'Cayenne pepper is 10x hotter than typical jalapeños!',
  },
  {
    q: 'What gives traditional Zaika Makhani gravy its signature golden hue and velvet creaminess?',
    options: ['Kashmiri Mirch & Fenugreek', 'Curry Powder', 'Saffron Only', 'Star Anise'],
    answerIndex: 0,
    fact: 'Kashmiri chili gives deep red color without scorching pungency.',
  },
  {
    q: 'Which cooling spice pod is essential to authentic dum biryani aromatics?',
    options: ['Green Cardamom', 'Mustard Seed', 'Fenugreek Leaf', 'Sumac'],
    answerIndex: 0,
    fact: 'Cardamom is called the Queen of Spices across South Asia.',
  },
  {
    q: 'What active bioactive compound in hot chilies binds to tongue heat receptors?',
    options: ['Piperine', 'Capsaicin', 'Curcumin', 'Eugenol'],
    answerIndex: 1,
    fact: 'Capsaicin stimulates the TRPV1 thermoreceptor, creating heat sensations without burning tissue.',
  },
  {
    q: 'Which prized spice is harvested entirely by hand from delicate purple Crocus flowers?',
    options: ['Turmeric', 'Annatto', 'Saffron', 'Paprika'],
    answerIndex: 2,
    fact: 'It takes over 75,000 saffron blossoms to produce a single pound of threads!',
  },
];

export function SpiceQuizDialog({
  open,
  onClose,
  sessionId,
  playerNickname,
  tableNumber,
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
              title: 'Quiz score submitted!',
              description: `You scored ${nextScore} points for ${tableNumber ? `Table ${tableNumber}` : 'your table'}`,
              variant: 'success',
            });
          }
        } catch {
          showToast({ title: 'Could not sync high score', variant: 'warning' });
        } finally {
          setSubmitting(false);
        }
      }
    }, 1100);
  };

  const handleRestart = () => {
    setStep(0);
    setScore(0);
    setSelectedIdx(null);
    setIsFinished(false);
    setCouponCode(null);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Table Multiplayer: Spice Quiz">
      <div className="space-y-5 py-2">
        {/* Table Contest Header */}
        <div className="flex items-center justify-between rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-sm bg-[var(--pb-accent)] text-[var(--pb-accent-ink)] font-bold shadow-sm">
              <Flame className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-[var(--pb-muted)]">
                {tableNumber ? `Table ${tableNumber} Challenge` : 'Live Table Trivia'}
              </p>
              <p className="font-display text-sm font-bold text-[var(--pb-ink)]">
                Player: <span className="text-[var(--pb-accent)]">{playerNickname || 'Guest'}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-xl font-bold tabular-nums text-[var(--pb-gold)]">
              {score}
            </span>
            <span className="text-xs font-semibold text-[var(--pb-muted)] block">PTS</span>
          </div>
        </div>

        {!isFinished && currentQ ? (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-[var(--pb-muted)]">
                <span>Question {step + 1} of {QUESTIONS.length}</span>
                <span>Round {step + 1}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--pb-border)]">
                <div
                  className="h-full bg-[var(--pb-accent)] transition-all duration-300"
                  style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-5 shadow-sm">
              <h3 className="font-display text-lg font-bold leading-snug text-[var(--pb-ink)]">
                {currentQ.q}
              </h3>
            </div>

            {/* Options */}
            <div className="grid gap-2.5">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedIdx === idx;
                const isCorrect = idx === currentQ.answerIndex;
                let stateClasses = 'border-[var(--pb-border)] bg-[var(--pb-surface)] hover:border-[var(--pb-accent)]';

                if (selectedIdx !== null) {
                  if (isCorrect) {
                    stateClasses = 'border-[var(--pb-olive)] bg-[var(--pb-olive)]/15 text-[var(--pb-olive)] font-bold';
                  } else if (isSelected) {
                    stateClasses = 'border-[var(--pb-chili)] bg-[var(--pb-chili)]/15 text-[var(--pb-chili)] line-through';
                  }
                }

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={selectedIdx !== null}
                    onClick={() => handleSelectOption(idx)}
                    className={`flex items-center justify-between rounded-sm border p-3.5 text-left text-sm font-medium transition-all active:scale-98 ${stateClasses}`}
                  >
                    <span>{option}</span>
                    {selectedIdx !== null && isCorrect && (
                      <CheckCircle2 className="size-4 text-[var(--pb-olive)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedIdx !== null && (
              <p className="rounded-sm bg-[var(--pb-surface-raised)] p-3 text-xs text-[var(--pb-muted)] italic animate-fadeIn">
                💡 <span className="font-semibold text-[var(--pb-ink)]">Chef Fact:</span> {currentQ.fact}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-sm bg-[var(--pb-gold)]/15 text-[var(--pb-gold)]">
              <Trophy className="size-8" aria-hidden="true" />
            </div>

            <div>
              <h3 className="font-display text-2xl font-bold text-[var(--pb-ink)]">
                Quiz Completed!
              </h3>
              <p className="text-sm text-[var(--pb-muted)]">
                You earned <span className="font-bold text-[var(--pb-gold)]">{score} points</span> out of {QUESTIONS.length * 100}
              </p>
            </div>

            {couponCode && (
              <div className="rounded-sm border-2 border-dashed border-[var(--pb-accent)] bg-[var(--pb-accent)]/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-accent)]">
                  Table High-Score Reward Unlocked!
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-widest text-[var(--pb-ink)]">
                  {couponCode}
                </p>
                <p className="mt-1 text-[11px] text-[var(--pb-muted)]">
                  Show this code to your waiter for 5% off dessert or coffee!
                </p>
              </div>
            )}

            {/* Table Leaderboard */}
            <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] p-4 text-left">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)] mb-3">
                <Users className="size-3.5" aria-hidden="true" />
                Live Table & Venue Leaderboard
              </p>
              <div className="divide-y divide-[var(--pb-border)]">
                {leaderboard.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-medium text-[var(--pb-ink)]">
                      #{idx + 1} {entry.playerNickname}
                    </span>
                    <span className="font-mono font-bold text-[var(--pb-gold)]">
                      {entry.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="flex-1 rounded-sm border border-[var(--pb-border)] py-3 text-xs font-semibold hover:border-[var(--pb-accent)] transition-all"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-sm bg-[var(--pb-accent)] py-3 text-xs font-bold text-[var(--pb-accent-ink)] hover:opacity-95 shadow-md transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting Score…' : 'Back to Table'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

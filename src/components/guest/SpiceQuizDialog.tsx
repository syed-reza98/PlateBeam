'use client';

import { useState } from 'react';
import { CheckCircle2, Flame, Trophy, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import { GUEST_DIALOG_CLASS } from './GuestPortalClient';
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Table Multiplayer: Spice Quiz"
      closedby="any"
      className={GUEST_DIALOG_CLASS}
    >
      <div className="space-y-5 py-1">
        {/* Table Contest Header */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-[#FAF7F2] p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#FF5412] text-white shadow-sm">
              <Flame className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-zinc-500">
                {tableNumber ? `Table ${tableNumber} Challenge` : 'Live Table Trivia'}
              </p>
              <p className="font-sans text-sm font-bold text-zinc-900">
                Player: <span className="text-[#FF5412]">{playerNickname || 'Guest'}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-xl font-bold tabular-nums text-amber-600 block">
              {score}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
              PTS
            </span>
          </div>
        </div>

        {!isFinished && currentQ ? (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-500">
                <span>Question {step + 1} of {QUESTIONS.length}</span>
                <span>Round {step + 1}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full bg-[#FF5412] transition-all duration-300"
                  style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="rounded-2xl border border-zinc-200 bg-[#FAF7F2] p-4">
              <h3 className="font-sans text-base font-bold leading-snug text-zinc-900">
                {currentQ.q}
              </h3>
            </div>

            {/* Options */}
            <div className="grid gap-2">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedIdx === idx;
                const isCorrect = idx === currentQ.answerIndex;
                let stateClasses = 'border-zinc-200 bg-white text-zinc-900 hover:border-[#FF5412]';

                if (selectedIdx !== null) {
                  if (isCorrect) {
                    stateClasses = 'border-emerald-300 bg-emerald-50 text-emerald-700 font-bold';
                  } else if (isSelected) {
                    stateClasses = 'border-red-300 bg-red-50 text-red-600 line-through';
                  }
                }

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={selectedIdx !== null}
                    onClick={() => handleSelectOption(idx)}
                    className={`flex min-h-[44px] items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-all ${stateClasses}`}
                  >
                    <span>{option}</span>
                    {selectedIdx !== null && isCorrect && (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedIdx !== null && (
              <p className="rounded-xl border border-zinc-200 bg-[#FAF7F2] p-3 text-xs text-zinc-600">
                <span className="font-bold text-zinc-900">Chef Fact:</span> {currentQ.fact}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
              <Trophy className="size-8" aria-hidden="true" />
            </div>

            <div>
              <h3 className="font-sans text-xl font-extrabold text-zinc-900">
                Quiz Completed!
              </h3>
              <p className="text-sm text-zinc-500">
                You earned <span className="font-bold text-amber-600">{score} points</span> out of {QUESTIONS.length * 100}
              </p>
            </div>

            {couponCode && (
              <div className="rounded-2xl border-2 border-dashed border-[#FF5412] bg-[#FF5412]/8 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#FF5412]">
                  Table High-Score Reward Unlocked!
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-widest text-zinc-900">
                  {couponCode}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Show this code to your waiter for 5% off dessert or coffee!
                </p>
              </div>
            )}

            {/* Table Leaderboard */}
            <div className="rounded-2xl border border-zinc-200 bg-[#FAF7F2] p-4 text-left">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                <Users className="size-3.5" aria-hidden="true" />
                Live Table &amp; Venue Leaderboard
              </p>
              <div className="divide-y divide-zinc-200">
                {leaderboard.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-semibold text-zinc-900">
                      #{idx + 1} {entry.playerNickname}
                    </span>
                    <span className="font-mono font-bold text-amber-600">
                      {entry.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleRestart}
                className="min-h-[44px] flex-1 rounded-xl border border-zinc-200 bg-[#FAF7F2] py-2.5 text-xs font-bold text-zinc-900 transition-colors hover:border-[#FF5412]"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[44px] flex-1 rounded-xl bg-[#FF5412] py-2.5 text-xs font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033] disabled:opacity-50"
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

import type { LoyaltyTier } from '../db/types';
import type { RealtimePort } from '../ports/realtime.port';
import type {
  AuditRepository,
  GuestEngagementRepository,
  GuestRecord,
  KitchenStationRecord,
  MenuItemRecord,
  MiniGameSessionRecord,
  OrderItemRecord,
  OutletRecord,
  ReviewRecord,
} from '../ports/repositories.port';
import { writeAuditLog } from './rbac.service';

export interface SpiceQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  spiceFact: string;
}

export const SPICE_QUIZ_QUESTIONS: SpiceQuizQuestion[] = [
  {
    id: 'sq-1',
    question: 'Which compound gives chili peppers their heat?',
    options: ['Piperine', 'Capsaicin', 'Curcumin', 'Eugenol'],
    correctIndex: 1,
    spiceFact: 'Capsaicin binds to TRPV1 heat receptors on your tongue.',
  },
  {
    id: 'sq-2',
    question: 'Which spice is known as the "Queen of Spices"?',
    options: ['Green Cardamom', 'Black Pepper', 'Saffron', 'Star Anise'],
    correctIndex: 0,
    spiceFact: 'Green cardamom is prized across South Asian desserts and biryanis.',
  },
  {
    id: 'sq-3',
    question: 'What gives turmeric its vibrant golden color?',
    options: ['Lycopene', 'Beta-carotene', 'Curcumin', 'Anthocyanin'],
    correctIndex: 2,
    spiceFact: 'Curcumin is best absorbed when paired with black pepper.',
  },
  {
    id: 'sq-4',
    question: 'Which scale measures the pungency of chili peppers?',
    options: ['Beaufort Scale', 'Scoville Scale', 'Richter Scale', 'Brix Scale'],
    correctIndex: 1,
    spiceFact: 'Wilbur Scoville devised the organoleptic test in 1912.',
  },
];

/**
 * Derives live cook countdown from KDS station queue depth and item prep times (FR-017).
 */
export function estimateCookCountdown(input: {
  sessionItems: Array<Pick<OrderItemRecord, 'id' | 'menuItemId' | 'stationId' | 'kdsStatus' | 'startedAt'>>;
  stationQueue: Array<Pick<OrderItemRecord, 'id' | 'stationId' | 'kdsStatus' | 'menuItemId'>>;
  menuItemsById: Map<string, Pick<MenuItemRecord, 'prepTimeMins'>>;
  stationsById: Map<string, Pick<KitchenStationRecord, 'slaTargetMins'>>;
  now?: Date;
}): {
  estimatedRemainingSeconds: number;
  estimatedReadyAt: Date;
  activeQueueDepth: number;
} {
  const now = input.now ?? new Date();
  const activeSessionItems = input.sessionItems.filter(
    (i) => i.kdsStatus === 'PENDING' || i.kdsStatus === 'ACCEPTED' || i.kdsStatus === 'PREPARING',
  );

  if (activeSessionItems.length === 0) {
    return {
      estimatedRemainingSeconds: 0,
      estimatedReadyAt: now,
      activeQueueDepth: 0,
    };
  }

  let maxStationSeconds = 0;
  let totalQueueDepth = 0;

  const byStation = new Map<string, typeof activeSessionItems>();
  for (const item of activeSessionItems) {
    const arr = byStation.get(item.stationId) ?? [];
    arr.push(item);
    byStation.set(item.stationId, arr);
  }

  for (const [stationId, items] of byStation.entries()) {
    const stationQueueDepth = input.stationQueue.filter(
      (q) =>
        q.stationId === stationId &&
        (q.kdsStatus === 'PENDING' || q.kdsStatus === 'ACCEPTED' || q.kdsStatus === 'PREPARING'),
    ).length;
    totalQueueDepth += stationQueueDepth;

    const stationDefaultMins = input.stationsById.get(stationId)?.slaTargetMins ?? 12;
    const maxItemPrepMins = Math.max(
      ...items.map((i) => input.menuItemsById.get(i.menuItemId)?.prepTimeMins ?? stationDefaultMins),
    );

    // Add 90 seconds per queued item ahead at the same station (capped at +15 mins)
    const queueDelaySecs = Math.min(900, Math.max(0, stationQueueDepth - items.length) * 90);
    const earliestStarted = items
      .map((i) => i.startedAt)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const elapsedSecs = earliestStarted
      ? Math.max(0, Math.floor((now.getTime() - earliestStarted.getTime()) / 1000))
      : 0;

    const stationSecs = Math.max(60, maxItemPrepMins * 60 + queueDelaySecs - elapsedSecs);
    if (stationSecs > maxStationSeconds) {
      maxStationSeconds = stationSecs;
    }
  }

  return {
    estimatedRemainingSeconds: maxStationSeconds,
    estimatedReadyAt: new Date(now.getTime() + maxStationSeconds * 1000),
    activeQueueDepth: totalQueueDepth,
  };
}

/**
 * Builds the Guest Wi-Fi Card payload (FR-018).
 */
export function buildGuestWifiCard(
  outlet: Pick<OutletRecord, 'wifiSsid' | 'wifiPasswordEnc'>,
): {
  available: boolean;
  ssid: string | null;
  password: string | null;
  wifiQrPayload: string | null;
} {
  if (!outlet.wifiSsid) {
    return { available: false, ssid: null, password: null, wifiQrPayload: null };
  }
  const password = outlet.wifiPasswordEnc ?? '';
  const esc = (v: string) => v.replace(/([\\;,:"])/g, '\\$1');
  const wifiQrPayload = password
    ? `WIFI:T:WPA;S:${esc(outlet.wifiSsid)};P:${esc(password)};;`
    : `WIFI:T:nopass;S:${esc(outlet.wifiSsid)};;`;

  return {
    available: true,
    ssid: outlet.wifiSsid,
    password: password || null,
    wifiQrPayload,
  };
}

/**
 * Computes loyalty tier from cumulative points (FR-019).
 */
export function calculateLoyaltyTier(points: number): LoyaltyTier {
  if (points >= 5000) return 'PLATINUM';
  if (points >= 2000) return 'GOLD';
  if (points >= 500) return 'SILVER';
  return 'BRONZE';
}

export async function awardLoyaltyPointsForSpend(
  engagementRepo: GuestEngagementRepository,
  input: {
    tenantId: string;
    guestId: string;
    paidAmountMinor: number;
    pointsPer100Minor?: number;
  },
): Promise<{ guest: GuestRecord; pointsEarned: number; tier: LoyaltyTier }> {
  const rate = input.pointsPer100Minor ?? 1;
  const pointsEarned = Math.max(0, Math.floor((input.paidAmountMinor / 100) * rate));
  const guest = await engagementRepo.addLoyaltyPoints(
    input.tenantId,
    input.guestId,
    pointsEarned,
  );
  return {
    guest,
    pointsEarned,
    tier: calculateLoyaltyTier(guest.loyaltyPoints),
  };
}

/**
 * Records a Spice Quiz / mini-game score and awards a daily high-score coupon (FR-020).
 */
export async function submitMiniGameScore(
  deps: {
    engagement: GuestEngagementRepository;
    realtime: RealtimePort;
  },
  input: {
    tenantId: string;
    outletId: string;
    sessionId: string;
    gameType: string;
    playerNickname: string;
    score: number;
  },
): Promise<{
  entry: MiniGameSessionRecord;
  isDailyHighScore: boolean;
  rewardCouponCode: string | null;
  leaderboard: MiniGameSessionRecord[];
}> {
  const existingLeaderboard = await deps.engagement.listMiniGameLeaderboard(
    input.tenantId,
    input.outletId,
  );
  const topScore = existingLeaderboard.reduce(
    (max, row) => Math.max(max, row.score),
    0,
  );

  const isDailyHighScore = input.score > 0 && input.score >= topScore;
  const rewardCouponCode = isDailyHighScore
    ? `SPICE5-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    : null;

  const entry = await deps.engagement.recordMiniGameScore({
    tenantId: input.tenantId,
    outletId: input.outletId,
    sessionId: input.sessionId,
    gameType: input.gameType,
    playerNickname: input.playerNickname,
    score: input.score,
    rewardCouponCode,
  });

  const updatedLeaderboard = await deps.engagement.listMiniGameLeaderboard(
    input.tenantId,
    input.outletId,
  );

  await deps.realtime.publishToTableSession(
    input.tenantId,
    input.sessionId,
    'game.tick',
    {
      entryId: entry.id,
      playerNickname: entry.playerNickname,
      score: entry.score,
      isDailyHighScore,
      rewardCouponCode,
    },
  );

  return {
    entry,
    isDailyHighScore,
    rewardCouponCode,
    leaderboard: updatedLeaderboard,
  };
}

/**
 * Post-meal 5-star review routing (FR-031):
 * - 4–5 stars -> Google Review CTA
 * - 1–3 stars -> Private feedback + immediate manager alert
 */
export async function submitPostMealReview(
  deps: {
    engagement: GuestEngagementRepository;
    audit: AuditRepository;
    realtime: RealtimePort;
  },
  input: {
    tenantId: string;
    outletId: string;
    sessionId: string;
    guestId?: string | null;
    rating: number;
    comment?: string | null;
    tags?: string[];
  },
): Promise<{
  review: ReviewRecord;
  route: 'GOOGLE_REVIEW' | 'PRIVATE_FEEDBACK';
  managerAlerted: boolean;
}> {
  const isLowRating = input.rating <= 3;

  const review = await deps.engagement.createReview({
    tenantId: input.tenantId,
    outletId: input.outletId,
    sessionId: input.sessionId,
    guestId: input.guestId ?? null,
    rating: input.rating,
    comment: input.comment ?? null,
    tags: input.tags ?? [],
    managerNotified: isLowRating,
  });

  if (isLowRating) {
    await writeAuditLog(deps.audit, {
      tenantId: input.tenantId,
      outletId: input.outletId,
      action: 'LOW_RATING_MANAGER_ALERT',
      entityType: 'reviews',
      entityId: review.id,
      afterState: {
        rating: review.rating,
        sessionId: review.sessionId,
        comment: review.comment,
        tags: review.tags,
      },
    });

    await deps.realtime.publishToFloor(
      input.tenantId,
      input.outletId,
      'waiter.called',
      {
        kind: 'LOW_RATING_ALERT',
        reviewId: review.id,
        sessionId: review.sessionId,
        rating: review.rating,
      },
    );
  }

  return {
    review,
    route: isLowRating ? 'PRIVATE_FEEDBACK' : 'GOOGLE_REVIEW',
    managerAlerted: isLowRating,
  };
}

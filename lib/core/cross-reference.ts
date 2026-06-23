/**
 * Cross-reference payment-service exports (Bit, PayPal) with bank/CC
 * transactions already in the database.
 *
 * When a user uploads a Bit/PayPal file:
 *  • Bank entries like "Bit Payment" are enriched with the real recipient.
 *  • CC detail entries like "העברה בBIT" are enriched with the payment
 *    description from the service export (e.g. "העברת ביט - טיפול 10").
 *
 * Matching is done on date (±1 day) + amount (±0.01).
 */

import { isPaymentServiceProxy } from './deduplication';

export interface CrossRefCandidate {
  id: string;
  date: Date;
  amount: number;
  merchant: string;
  description?: string;
  sourceType?: string;
}

export interface CrossRefMatch {
  targetTransactionId: string;
  psMerchant: string;
  psDescription: string | undefined;
  confidence: number;
}

export interface CrossRefResult {
  matched: CrossRefMatch[];
  unmatched: CrossRefCandidate[];
}

/**
 * Match newly-uploaded payment-service transactions against existing
 * proxy rows (bank "Bit Payment" or CC "העברה בBIT") in the database.
 */
export function crossReference(
  existingProxies: CrossRefCandidate[],
  psTransactions: CrossRefCandidate[],
  serviceKeyword: string
): CrossRefResult {
  const matched: CrossRefMatch[] = [];
  const usedTargetIds = new Set<string>();
  const usedPsIds = new Set<string>();

  const relevantProxies = existingProxies.filter((bp) =>
    bp.merchant.toLowerCase().includes(serviceKeyword.toLowerCase())
  );

  const pairs: Array<{
    target: CrossRefCandidate;
    ps: CrossRefCandidate;
    score: number;
  }> = [];

  for (const target of relevantProxies) {
    for (const ps of psTransactions) {
      const score = matchScore(target, ps);
      if (score > 0) {
        pairs.push({ target, ps, score });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  for (const { target, ps, score } of pairs) {
    if (usedTargetIds.has(target.id) || usedPsIds.has(ps.id)) continue;

    matched.push({
      targetTransactionId: target.id,
      psMerchant: ps.merchant,
      psDescription: ps.description,
      confidence: score,
    });
    usedTargetIds.add(target.id);
    usedPsIds.add(ps.id);
  }

  const unmatched = psTransactions.filter((ps) => !usedPsIds.has(ps.id));

  return { matched, unmatched };
}

function matchScore(
  bank: CrossRefCandidate,
  ps: CrossRefCandidate
): number {
  const amountDiff = Math.abs(Math.abs(bank.amount) - Math.abs(ps.amount));
  if (amountDiff > 0.01) return 0;

  const timeDiff = Math.abs(bank.date.getTime() - ps.date.getTime());
  const oneDay = 24 * 60 * 60 * 1000;
  if (timeDiff > oneDay) return 0;

  let score = 0.5; // amount match
  if (timeDiff === 0) {
    score += 0.3; // exact date
  } else {
    score += 0.2; // within 1 day
  }

  if (!isPaymentServiceProxy(ps.merchant)) {
    score += 0.2; // ps has a real merchant name
  }

  return Math.min(score, 1);
}

/**
 * Detect the payment service type from the source type or filename.
 * Returns the keyword to use for cross-referencing, or null if not a
 * payment service file.
 */
export function detectPaymentService(
  sourceType: string,
  filename: string
): string | null {
  const lower = sourceType.toLowerCase();
  if (lower === 'bit') return 'bit';
  if (lower === 'paypal') return 'paypal';
  if (lower === 'google_pay') return 'google pay';
  if (lower === 'apple_pay') return 'apple pay';

  const fLower = filename.toLowerCase();
  if (fLower.includes('bit')) return 'bit';
  if (fLower.includes('paypal')) return 'paypal';

  return null;
}

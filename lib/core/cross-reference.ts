/**
 * Cross-reference payment-service exports (Bit, PayPal) with bank statement
 * transactions already in the database.
 *
 * When a user uploads a Bit/PayPal file, bank entries like "Bit Payment" or
 * "PayPal" are enriched with the real recipient name from the payment-service
 * export.  Matching is done on date (±1 day) + amount (±0.01).
 */

import { isPaymentServiceProxy } from './deduplication';

export interface CrossRefCandidate {
  id: string;
  date: Date;
  amount: number;
  merchant: string;
}

export interface CrossRefMatch {
  bankTransactionId: string;
  newMerchant: string;
  newDescription: string | undefined;
  confidence: number;
}

export interface CrossRefResult {
  matched: CrossRefMatch[];
  unmatched: CrossRefCandidate[];
}

/**
 * Match newly-uploaded payment-service transactions against existing bank
 * "proxy" rows (e.g. "Bit Payment", "PayPal") in the database.
 *
 * @param bankProxies     Bank transactions whose merchant matches a payment
 *                        service keyword and haven't been enriched yet.
 * @param psTransactions  Newly-uploaded payment-service transactions.
 * @param serviceKeyword  The payment service to match (e.g. "bit", "paypal").
 */
export function crossReference(
  bankProxies: CrossRefCandidate[],
  psTransactions: CrossRefCandidate[],
  serviceKeyword: string
): CrossRefResult {
  const matched: CrossRefMatch[] = [];
  const usedBankIds = new Set<string>();
  const usedPsIds = new Set<string>();

  const relevantProxies = bankProxies.filter((bp) =>
    bp.merchant.toLowerCase().includes(serviceKeyword.toLowerCase())
  );

  // Score all possible pairs, then greedily pick the best matches.
  const pairs: Array<{
    bank: CrossRefCandidate;
    ps: CrossRefCandidate;
    score: number;
  }> = [];

  for (const bp of relevantProxies) {
    for (const ps of psTransactions) {
      const score = matchScore(bp, ps);
      if (score > 0) {
        pairs.push({ bank: bp, ps, score });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  for (const { bank, ps, score } of pairs) {
    if (usedBankIds.has(bank.id) || usedPsIds.has(ps.id)) continue;

    matched.push({
      bankTransactionId: bank.id,
      newMerchant: ps.merchant,
      newDescription: `${serviceKeyword} → ${ps.merchant}`,
      confidence: score,
    });
    usedBankIds.add(bank.id);
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

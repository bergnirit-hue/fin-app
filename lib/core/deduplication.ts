import { ParsedTransaction } from './parser';

export interface DedupResult {
  merged: ParsedTransaction[];
  conflicts: ConflictResolution[];
}

export interface ConflictResolution {
  bankTransaction: ParsedTransaction;
  potentialMatches: ParsedTransaction[];
  selectedIndex?: number;
}

const PAYMENT_SERVICE_KEYWORDS = [
  'bit',
  'paypal',
  'google pay',
  'apple pay',
  'stripe',
  'square',
  '2pay',
];

export class DeduplicationEngine {
  static deduplicateAndMap(
    transactions: ParsedTransaction[]
  ): DedupResult {
    const conflicts: ConflictResolution[] = [];
    const processed = new Set<number>();
    const merged: ParsedTransaction[] = [];

    // First pass: handle exact matches (simple duplicates)
    for (let i = 0; i < transactions.length; i++) {
      if (processed.has(i)) continue;

      const current = transactions[i];
      let duplicate = false;

      for (let j = i + 1; j < transactions.length; j++) {
        if (processed.has(j)) continue;

        const other = transactions[j];

        if (this.isExactMatch(current, other)) {
          processed.add(j);
          duplicate = true;
        }
      }

      if (!duplicate) {
        merged.push(current);
      }
      processed.add(i);
    }

    // Second pass: handle payment service mapping
    const result = this.mapPaymentServices(merged);
    result.conflicts = conflicts;

    return result;
  }

  private static mapPaymentServices(
    transactions: ParsedTransaction[]
  ): DedupResult {
    const bankTransactions = transactions.filter(
      (t) => t.sourceType === 'bank'
    );
    const paymentServiceTransactions = transactions.filter(
      (t) => t.sourceType !== 'bank'
    );

    const conflicts: ConflictResolution[] = [];
    const merged: ParsedTransaction[] = [];
    const matchedPaymentServices = new Set<number>();

    for (let i = 0; i < bankTransactions.length; i++) {
      const bankTx = bankTransactions[i];

      if (this.isPaymentServiceProxy(bankTx.merchant)) {
        const candidates = paymentServiceTransactions
          .map((psTx, idx) => ({ tx: psTx, idx }))
          .filter(
            ({ tx, idx }) =>
              !matchedPaymentServices.has(idx) &&
              this.isFuzzyMatch(bankTx, tx)
          );

        if (candidates.length === 1) {
          // Auto-match: exactly one candidate
          const matched = candidates[0];
          const merged_tx: ParsedTransaction = {
            ...bankTx,
            merchant: matched.tx.merchant,
            description:
              matched.tx.description || bankTx.description,
            sourceType: `bank+${matched.tx.sourceType}`,
          };
          merged.push(merged_tx);
          matchedPaymentServices.add(matched.idx);
        } else if (candidates.length > 1) {
          // Conflict: multiple candidates
          conflicts.push({
            bankTransaction: bankTx,
            potentialMatches: candidates.map((c) => c.tx),
          });
          merged.push(bankTx);
        } else {
          // No match found
          merged.push(bankTx);
        }
      } else {
        merged.push(bankTx);
      }
    }

    // Add unmatched payment service transactions
    for (let i = 0; i < paymentServiceTransactions.length; i++) {
      if (!matchedPaymentServices.has(i)) {
        merged.push(paymentServiceTransactions[i]);
      }
    }

    return { merged, conflicts };
  }

  private static isExactMatch(
    tx1: ParsedTransaction,
    tx2: ParsedTransaction
  ): boolean {
    const sameDate =
      tx1.date.toDateString() === tx2.date.toDateString();
    const sameAmount = Math.abs(tx1.amount - tx2.amount) < 0.01;
    const sameMerchant = tx1.merchant === tx2.merchant;

    return sameDate && sameAmount && sameMerchant;
  }

  private static isFuzzyMatch(
    bankTx: ParsedTransaction,
    psaTx: ParsedTransaction
  ): boolean {
    // Amount within ±0.01
    const sameAmount = Math.abs(bankTx.amount - psaTx.amount) < 0.01;

    // Date within ±1 day
    const timeDiff = Math.abs(
      bankTx.date.getTime() - psaTx.date.getTime()
    );
    const sameDate = timeDiff <= 24 * 60 * 60 * 1000;

    // Confidence score: >0.95 = auto-match, lower = conflict
    if (sameAmount && sameDate) {
      return true;
    }

    return false;
  }

  private static isPaymentServiceProxy(merchant: string): boolean {
    const lowerMerchant = merchant.toLowerCase();
    return PAYMENT_SERVICE_KEYWORDS.some((keyword) =>
      lowerMerchant.includes(keyword)
    );
  }

  static getConfidenceScore(
    bankTx: ParsedTransaction,
    psaTx: ParsedTransaction
  ): number {
    let score = 0;

    // Amount match (exact = 0.5 points)
    if (Math.abs(bankTx.amount - psaTx.amount) < 0.01) {
      score += 0.5;
    }

    // Date match (same day = 0.3, within 1 day = 0.2)
    const timeDiff = Math.abs(
      bankTx.date.getTime() - psaTx.date.getTime()
    );
    if (timeDiff === 0) {
      score += 0.3;
    } else if (timeDiff <= 24 * 60 * 60 * 1000) {
      score += 0.2;
    }

    // Additional check: if PSA has more specific merchant info
    if (psaTx.merchant && !this.isPaymentServiceProxy(psaTx.merchant)) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }
}

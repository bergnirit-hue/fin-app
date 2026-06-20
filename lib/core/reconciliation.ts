/**
 * Credit-card ↔ bank-statement reconciliation.
 *
 * When a user uploads a credit-card detail file, the individual charges are
 * already accounted for as a single lump-sum debit in the bank statement
 * (e.g. "ישראכרט −₪5,000").  This module matches the two so we can:
 *   • nest the CC details under the bank row (expandable drill-down)
 *   • avoid double-counting the total in income/expense summaries
 */

// Israeli credit-card company name patterns as they appear in bank statements.
const CC_COMPANY_PATTERNS: RegExp[] = [
  /ישראכרט/i,
  /isracard/i,
  /כאל/i,
  /\bcal\b/i,
  /מקס\b/i,
  /\bmax\b/i,
  /לאומי.?קארד/i,
  /leumi.?card/i,
  /אמריקן.?אקספרס/i,
  /amex/i,
  /american.?express/i,
  /דיינרס/i,
  /diners/i,
  /מסטרקארד/i,
  /mastercard/i,
  /ויזה/i,
  /visa/i,
  /כ['׳"].?אשראי/i,
  /חיוב.?כרטיס/i,
  /כרטיס.?אשראי/i,
];

/** Returns `true` when the merchant string looks like a credit-card company. */
export function isCreditCardMerchant(merchant: string): boolean {
  return CC_COMPANY_PATTERNS.some((re) => re.test(merchant));
}

// Column-header patterns that are specific to Israeli credit-card exports
// (Isracard, Cal, Max, Leumi Card, etc.) and NOT found in bank statements.
const CC_HEADER_PATTERNS: RegExp[] = [
  /סכום.?חיוב/,         // "סכום חיוב" — charge amount
  /סכום.?עסקה/,         // "סכום עסקה" — transaction amount
  /תאריך.?עסקה/,        // "תאריך עסקה" — transaction date
  /בית.?עסק/,           // "שם בית עסק" — merchant name (CC-specific phrasing)
  /ספרות.?אחרונות/,     // "4 ספרות אחרונות" — last 4 digits
  /סוג.?עסקה/,          // "סוג עסקה" — transaction type
  /מטבע.?עסקה/,         // "מטבע עסקה" — transaction currency
  /מקור/,               // "מקור" — origin (Isracard)
  /הערות/,              // can appear in both, but combined with others → CC
];

/**
 * Check whether file column headers look like a credit-card statement.
 * Matches when at least 2 CC-specific header patterns are found.
 */
export function looksLikeCreditCardFile(headers: string[]): boolean {
  const joined = headers.join(' ');
  const hits = CC_HEADER_PATTERNS.filter((re) => re.test(joined)).length;
  return hits >= 2;
}

/**
 * Find the best-matching bank transaction for a set of credit-card charges.
 *
 * @param bankCandidates  Negative-amount bank transactions for the user.
 * @param ccTotal         Absolute total of the credit-card charges from the
 *                        uploaded file (always positive).
 * @param ccLatestDate    The most recent date among the CC charges — used to
 *                        narrow the search window.
 * @returns               The matching bank transaction, or `null`.
 */
export function findMatchingBankEntry<
  T extends { id: string; amount: number; merchant: string; date: Date }
>(
  bankCandidates: T[],
  ccTotal: number,
  ccLatestDate: Date
): T | null {
  // Only consider bank rows whose merchant name matches a CC company.
  const ccCandidates = bankCandidates.filter((c) =>
    isCreditCardMerchant(c.merchant)
  );

  if (ccCandidates.length === 0) return null;

  // Tolerance: ₪2 or 0.5 % of the total, whichever is larger.
  const tolerance = Math.max(2, ccTotal * 0.005);

  // Date window: the bank debit typically lands 0-45 days after the billing
  // cycle that the CC charges belong to.
  const windowMs = 45 * 24 * 60 * 60 * 1000;

  let best: T | null = null;
  let bestDiff = Infinity;

  for (const cand of ccCandidates) {
    const bankAbs = Math.abs(cand.amount);
    const diff = Math.abs(bankAbs - ccTotal);
    if (diff > tolerance) continue;

    // Check date proximity
    const dateDiff = Math.abs(cand.date.getTime() - ccLatestDate.getTime());
    if (dateDiff > windowMs) continue;

    if (diff < bestDiff) {
      bestDiff = diff;
      best = cand;
    }
  }

  return best;
}

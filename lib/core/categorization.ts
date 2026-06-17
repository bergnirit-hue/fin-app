import { ParsedTransaction } from './parser';

export interface CategorizationRule {
  pattern: RegExp;
  category: string;
}

export const DEFAULT_RULES: CategorizationRule[] = [
  // Dining & Groceries
  { pattern: /starbucks|cafe|coffee|donut/i, category: 'Dining' },
  { pattern: /restaurant|pizza|burger|taco|diner|bistro|grill/i, category: 'Dining' },
  { pattern: /supermarket|grocery|safeway|whole foods|trader joe|kroger|walmart|costco|market|tesco|sainsbury/i, category: 'Groceries' },

  // Transportation
  { pattern: /uber|lyft|taxi|parking|gas station|shell|chevron|exxon|bp|vehicle|car wash/i, category: 'Transportation' },
  { pattern: /airlines|flight|airport|delta|united|southwest|ryanair|easyjet|air france/i, category: 'Travel' },
  { pattern: /hotel|airbnb|booking|marriott|hilton|motel/i, category: 'Travel' },

  // Subscriptions & Entertainment
  { pattern: /netflix|spotify|hulu|disney|hbo|prime video|apple music|youtube|subscription/i, category: 'Subscriptions' },
  { pattern: /movie|cinema|theater|concert|ticket|eventbrite/i, category: 'Entertainment' },

  // Shopping
  { pattern: /amazon|ebay|shop|store|mall|retail|target|macy|nordstrom|h&m|gap|zara|uniqlo/i, category: 'Shopping' },

  // Health & Fitness
  { pattern: /gym|fitness|yoga|pilates|spa|massage|health|doctor|hospital|pharmacy|cvs|walgreens|clinic/i, category: 'Health' },

  // Utilities & Bills
  { pattern: /electric|water|gas|internet|phone|utility|verizon|at&t|comcast|bill|payment/i, category: 'Utilities' },

  // Insurance
  { pattern: /insurance|geico|progressive|state farm|allstate/i, category: 'Insurance' },

  // Rent & Housing
  { pattern: /rent|landlord|lease|mortgage|property|housing/i, category: 'Housing' },

  // Office & Work
  { pattern: /office|staples|supplies|business|professional/i, category: 'Office' },

  // Personal Care
  { pattern: /salon|barber|haircut|cosmetics|makeup|beauty|dermalogica|sephora|ulta/i, category: 'Personal Care' },

  // Kids & Family
  { pattern: /daycare|school|education|tuition|kids|childcare/i, category: 'Education' },

  // Gifts & Donations
  { pattern: /donation|charity|gift|greeting card/i, category: 'Gifts' },

  // Pet Care
  { pattern: /pet|vet|veterinary|dog|cat|animal|petsmart|petco/i, category: 'Pets' },
];

export class CategorizationEngine {
  private rules: CategorizationRule[];

  constructor(customRules?: CategorizationRule[]) {
    this.rules = customRules || DEFAULT_RULES;
  }

  categorize(transaction: ParsedTransaction): string {
    const searchText = `${transaction.merchant} ${transaction.description || ''}`;

    for (const rule of this.rules) {
      if (rule.pattern.test(searchText)) {
        return rule.category;
      }
    }

    return 'Other';
  }

  categorizeMany(
    transactions: ParsedTransaction[]
  ): (ParsedTransaction & { category: string })[] {
    return transactions.map((tx) => ({
      ...tx,
      category: this.categorize(tx),
    }));
  }

  addRule(pattern: RegExp | string, category: string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    this.rules.unshift({ pattern: regex, category });
  }

  getRules(): CategorizationRule[] {
    return [...this.rules];
  }
}

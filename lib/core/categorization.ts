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

  // --- Hebrew / Israeli merchants ---
  // Health / pharmacy / HMO (kept before groceries so Super-Pharm maps here)
  { pattern: /סופר.?פארם|ניו.?פארם|מכבי|כללית|מאוחדת|לאומית|בית מרקחת|קופת חולים|טרם/i, category: 'Health' },
  // Groceries
  { pattern: /שופרסל|רמי לוי|ויקטורי|יוחננוף|טיב טעם|מגה בעיר|יינות ביתן|אושר עד|מחסני השוק|מכולת|סופרמרקט|am.?pm/i, category: 'Groceries' },
  // Dining
  { pattern: /ארומה|קפה קפה|בית קפה|לנדוור|רולדין|מקדונלד|בורגר|פיצה|פלאפל|שווארמה|מסעד|וולט|wolt|מאפה/i, category: 'Dining' },
  // Transportation / fuel
  { pattern: /רכבת ישראל|אגד|מטרופולין|רב.?קו|פנגו|סלופארק|דלק|דור אלון|סונול|פז |מונית|חניון/i, category: 'Transportation' },
  // Housing / mortgage / property tax
  { pattern: /משכנתא|שכירות|שכ.?ד|ארנונה|ועד בית|דמי ניהול/i, category: 'Housing' },
  // Utilities / telecom
  { pattern: /חברת החשמל|תאגיד המים|מי אביבים|בזק|פרטנר|סלקום|הוט|yes|גולן טלקום|פלאפון/i, category: 'Utilities' },
  // Insurance
  { pattern: /ביטוח|הראל|כלל ביטוח|מגדל ביטוח|הפניקס|מנורה|איילון/i, category: 'Insurance' },
  // Shopping
  { pattern: /זארה|קסטרו|פוקס|רנואר|איקאה|הום סנטר|מקס סטוק|גולף|טרמינל איקס/i, category: 'Shopping' },
  // Education
  { pattern: /בית ספר|גן ילדים|אוניברסיט|מכללה|צהרון|שכר לימוד/i, category: 'Education' },
  // Entertainment
  { pattern: /סינמה|יס פלאנט|רב.?חן|הבימה|תיאטרון|הופעה|לונה פארק/i, category: 'Entertainment' },
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

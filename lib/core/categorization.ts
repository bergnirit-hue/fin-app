import { ParsedTransaction } from './parser';

export interface CategorizationRule {
  pattern: RegExp;
  category: string;
}

export const DEFAULT_RULES: CategorizationRule[] = [
  // ── Housing (דיור) ──
  { pattern: /rent|landlord|lease|mortgage|property|housing/i, category: 'Housing' },
  { pattern: /hoa|condo fee|building fee|home insurance/i, category: 'Housing' },
  { pattern: /משכנתא|שכירות|שכ.?ד|ועד בית|דמי ניהול|ביטוח מבנה/i, category: 'Housing' },

  // ── Utilities (חשבונות שוטפים) ──
  { pattern: /electric|water|gas|internet|phone|utility|verizon|at&t|comcast|bill/i, category: 'Utilities' },
  { pattern: /חברת החשמל|תאגיד המים|מי אביבים|בזק|פרטנר|סלקום|הוט|yes|גולן טלקום|פלאפון/i, category: 'Utilities' },
  { pattern: /ארנונה|גז /i, category: 'Utilities' },

  // ── Transportation (תחבורה והחזקת רכב) ──
  { pattern: /uber|lyft|taxi|parking|gas station|shell|chevron|exxon|bp|vehicle|car wash|car insurance/i, category: 'Transportation' },
  { pattern: /רכבת ישראל|אגד|מטרופולין|רב.?קו|פנגו|סלופארק|דלק|דור אלון|סונול|פז |מונית|חניון/i, category: 'Transportation' },
  { pattern: /ביטוח רכב|טסט|מוסך|תחבורה ציבורית/i, category: 'Transportation' },

  // ── Food & Shopping (מזון וקניות) ──
  { pattern: /supermarket|grocery|safeway|whole foods|trader joe|kroger|walmart|costco|market|tesco|sainsbury/i, category: 'Food & Shopping' },
  { pattern: /שופרסל|רמי לוי|ויקטורי|יוחננוף|טיב טעם|מגה בעיר|יינות ביתן|אושר עד|מחסני השוק|מכולת|סופרמרקט|am.?pm/i, category: 'Food & Shopping' },
  { pattern: /סופר.?פארם|ניו.?פארם|בית מרקחת/i, category: 'Food & Shopping' },
  { pattern: /amazon|ebay|shop|store|mall|retail|target|macy|nordstrom|h&m|gap|zara|uniqlo/i, category: 'Food & Shopping' },
  { pattern: /זארה|קסטרו|פוקס|רנואר|איקאה|הום סנטר|מקס סטוק|גולף|טרמינל איקס/i, category: 'Food & Shopping' },

  // ── Health (בריאות) ──
  { pattern: /gym|fitness|yoga|pilates|spa|massage|health|doctor|hospital|pharmacy|cvs|walgreens|clinic/i, category: 'Health' },
  { pattern: /מכבי|כללית|מאוחדת|לאומית|קופת חולים|טרם|רופא|תרופ|ביטוח בריאות/i, category: 'Health' },
  { pattern: /insurance|geico|progressive|state farm|allstate/i, category: 'Health' },
  { pattern: /ביטוח(?!.*רכב)(?!.*מבנה)/i, category: 'Health' },

  // ── Leisure (פנאי, בילויים וביגוד) ──
  { pattern: /starbucks|cafe|coffee|donut/i, category: 'Leisure' },
  { pattern: /restaurant|pizza|burger|taco|diner|bistro|grill/i, category: 'Leisure' },
  { pattern: /ארומה|קפה קפה|בית קפה|לנדוור|רולדין|מקדונלד|בורגר|פיצה|פלאפל|שווארמה|מסעד|וולט|wolt|מאפה/i, category: 'Leisure' },
  { pattern: /netflix|spotify|hulu|disney|hbo|prime video|apple music|youtube|subscription/i, category: 'Leisure' },
  { pattern: /movie|cinema|theater|concert|ticket|eventbrite/i, category: 'Leisure' },
  { pattern: /סינמה|יס פלאנט|רב.?חן|הבימה|תיאטרון|הופעה|לונה פארק/i, category: 'Leisure' },
  { pattern: /airlines|flight|airport|delta|united|southwest|ryanair|easyjet|air france/i, category: 'Leisure' },
  { pattern: /hotel|airbnb|booking|marriott|hilton|motel/i, category: 'Leisure' },
  { pattern: /salon|barber|haircut|cosmetics|makeup|beauty|dermalogica|sephora|ulta/i, category: 'Leisure' },
  { pattern: /pet|vet|veterinary|dog|cat|animal|petsmart|petco/i, category: 'Leisure' },
  { pattern: /donation|charity|gift|greeting card/i, category: 'Leisure' },

  // ── Education (חינוך וחוגים) ──
  { pattern: /daycare|school|education|tuition|kids|childcare/i, category: 'Education' },
  { pattern: /בית ספר|גן ילדים|אוניברסיט|מכללה|צהרון|שכר לימוד|חוג/i, category: 'Education' },

  // ── Emergency Fund (קרן חירום) ──
  { pattern: /emergency fund|rainy day/i, category: 'Emergency Fund' },
  { pattern: /קרן חירום/i, category: 'Emergency Fund' },

  // ── Long-term Savings (חסכונות ארוכי טווח) ──
  { pattern: /pension|retirement|401k|ira|roth/i, category: 'Long-term Savings' },
  { pattern: /פנסיה|קרן השתלמות|קופת גמל|חסכון/i, category: 'Long-term Savings' },

  // ── Debt Repayment (החזר חובות) ──
  { pattern: /loan repayment|debt payment|credit card payment/i, category: 'Debt Repayment' },
  { pattern: /החזר הלוואה|מינוס|החזר חוב/i, category: 'Debt Repayment' },
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

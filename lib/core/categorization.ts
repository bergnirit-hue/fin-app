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
  { pattern: /amazon|ebay|shop|store|mall|retail|target|macy|nordstrom/i, category: 'Food & Shopping' },
  { pattern: /איקאה|הום סנטר|מקס סטוק/i, category: 'Food & Shopping' },

  // ── Health (בריאות) ──
  { pattern: /gym|fitness|yoga|pilates|spa|massage|health|doctor|hospital|pharmacy|cvs|walgreens|clinic/i, category: 'Health' },
  { pattern: /מכבי|כללית|מאוחדת|לאומית|קופת חולים|טרם|רופא|תרופ|ביטוח בריאות/i, category: 'Health' },
  { pattern: /insurance|geico|progressive|state farm|allstate/i, category: 'Health' },
  { pattern: /ביטוח(?!.*רכב)(?!.*מבנה)/i, category: 'Health' },

  // ── Entertainment (פנאי ובילויים) ──
  { pattern: /starbucks|cafe|coffee|donut/i, category: 'Entertainment' },
  { pattern: /restaurant|pizza|burger|taco|diner|bistro|grill/i, category: 'Entertainment' },
  { pattern: /ארומה|קפה קפה|בית קפה|לנדוור|רולדין|מקדונלד|בורגר|פיצה|פלאפל|שווארמה|מסעד|וולט|wolt|מאפה/i, category: 'Entertainment' },
  { pattern: /movie|cinema|theater|concert|ticket|eventbrite/i, category: 'Entertainment' },
  { pattern: /סינמה|יס פלאנט|רב.?חן|הבימה|תיאטרון|הופעה|לונה פארק/i, category: 'Entertainment' },
  { pattern: /salon|barber|haircut|cosmetics|makeup|beauty|dermalogica|sephora|ulta/i, category: 'Entertainment' },
  { pattern: /pet|vet|veterinary|dog|cat|animal|petsmart|petco/i, category: 'Entertainment' },
  { pattern: /donation|charity|gift|greeting card/i, category: 'Entertainment' },

  // ── Clothing & Footwear (ביגוד והנעלה) ──
  { pattern: /h&m|gap|zara|uniqlo|nike|adidas|puma|new balance|skechers|crocs/i, category: 'Clothing & Footwear' },
  { pattern: /זארה|קסטרו|פוקס|רנואר|גולף|טרמינל איקס|נעלי|ביגוד|אופנה|שופרא|מנגו|pull\s*&\s*bear/i, category: 'Clothing & Footwear' },

  // ── Travel & Vacation (טיולים ונופש) ──
  { pattern: /airlines|flight|airport|delta|united|southwest|ryanair|easyjet|air france|el al|wizz air|turkish/i, category: 'Travel & Vacation' },
  { pattern: /hotel|airbnb|booking|marriott|hilton|motel|hostel|resort/i, category: 'Travel & Vacation' },
  { pattern: /טיסה|מלון|נופש|חופש|rent.?a.?car|car rental|hertz|avis|sixt/i, category: 'Travel & Vacation' },

  // ── Subscriptions (מנויים) ──
  { pattern: /netflix|spotify|hulu|disney|hbo|prime video|apple music|youtube|subscription/i, category: 'Subscriptions' },
  { pattern: /openai|chatgpt|claude|copilot|midjourney|notion|dropbox|icloud|google one/i, category: 'Subscriptions' },
  { pattern: /מנוי|סטינג|cellcom tv|partner tv/i, category: 'Subscriptions' },

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

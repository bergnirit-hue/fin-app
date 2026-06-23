import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

export type Lang = 'he' | 'en';

type Dict = Record<string, any>;

const en: Dict = {
  common: { appName: 'ElastiCash', loading: 'Loading...' },
  nav: {
    dashboard: 'Dashboard',
    upload: 'Upload',
    transactions: 'Transactions',
    settings: 'Settings',
    logout: 'Logout',
    switchTo: 'עברית',
  },
  login: {
    title: 'Login',
    subtitle: 'Track your finances with ease',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    noAccount: "Don't have an account?",
    signUp: 'Sign up',
    demo: 'Demo mode: Any email/password will work',
    failed: 'Login failed',
    error: 'An error occurred. Please try again.',
  },
  signup: {
    title: 'Sign Up',
    subtitle: 'Start tracking your finances',
    fullName: 'Full Name',
    fullNamePlaceholder: 'John Doe',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    createAccount: 'Create Account',
    creatingAccount: 'Creating Account...',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    demo: 'Demo mode: All signups are created immediately',
    mismatch: 'Passwords do not match',
    failed: 'Signup failed',
    error: 'An error occurred. Please try again.',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Track your finances and spending patterns at a glance',
    totalIncome: 'Total Income',
    totalExpenses: 'Total Expenses',
    totalSavings: 'Total Savings',
    savingsRate: 'Savings Rate',
    pctOfIncome: '{pct}% of income',
    thisMonth: 'This month',
    topCategories: 'Top Spending Categories',
    last30: 'Last 30 days',
    pctOfExpenses: '{pct}% of expenses',
    summary: 'Summary',
    income: 'Income',
    fixed: 'Fixed Expenses',
    variable: 'Variable Expenses',
    savingsDebt: 'Savings & Debt',
    netSavings: 'Net Savings',
    noData: 'No data yet',
    noDataSub: 'Start by uploading your first file',
    uploadFile: 'Upload File',
    ctaTitle: 'Ready to Add More Data?',
    ctaSub:
      'Upload transactions from multiple sources to get a complete picture of your finances',
    uploadNew: 'Upload New File',
    periodLastMonth: 'Last month',
    periodLast3: '3 months',
    periodLast6: '6 months',
    periodLastYear: 'Year',
    periodAll: 'All time',
    periodCustom: 'Custom',
  },
  upload: {
    title: 'Upload Transactions',
    subtitle:
      'Import your bank statements or payment service exports to analyze your spending',
    selectSource: 'Select Data Source',
    fileLabel: 'Upload File',
    dragDrop: 'Drag and drop your files here',
    orClick: 'or click to browse • Supports CSV and Excel files',
    selected: 'Selected: {name}',
    filesSelected: '{count} files selected',
    removeFile: 'Remove file',
    processing: 'Processing...',
    uploadProcess: 'Upload & Process',
    previewTitle: 'Preview (first 5 transactions)',
    thDate: 'Date',
    thMerchant: 'Merchant',
    thAmount: 'Amount',
    thCategory: 'Category',
    uncategorized: 'Uncategorized',
    errorSelect: 'Please select at least one file',
    errorUpload: 'Error uploading file',
    error: 'An error occurred',
    success: '✓ File processed successfully! {count} transactions saved',
    successMulti: '✓ {files} files processed successfully! {count} transactions saved',
    info1Title: 'Supported Formats',
    info1Desc: 'CSV and Excel files from any bank or payment service',
    info2Title: 'Secure & Private',
    info2Desc: 'All transactions are processed securely and encrypted',
    info3Title: 'Auto-Categorized',
    info3Desc: 'Transactions are automatically categorized and editable',
  },
  sources: {
    bank: 'Bank',
    bit: 'Bit',
    paypal: 'PayPal',
    google_pay: 'Google Pay',
    apple_pay: 'Apple Pay',
    credit_card: 'Credit Card',
  },
  transactions: {
    title: 'Transactions',
    subtitle: 'Review, filter, and manage your transactions',
    search: 'Search by merchant...',
    allCategories: 'All Categories',
    allTypes: 'All Types',
    fixed: 'Fixed',
    variable: 'Variable',
    savingsDebt: 'Savings & Debt',
    income: 'Income',
    thDate: 'Date',
    thMerchant: 'Merchant',
    thAmount: 'Amount',
    thCategory: 'Category',
    thType: 'Type',
    thSource: 'Source',
    none: 'No transactions found',
    totalTransactions: 'Total Transactions',
    totalAmount: 'Total Amount',
    avgTransaction: 'Average Transaction',
    reCategorize: 'Click to re-categorize',
    addCategory: 'Add Category',
    addCategoryTitle: 'Add New Category',
    categoryName: 'Category Name',
    categoryType: 'Category Type',
    save: 'Save',
    cancel: 'Cancel',
    detailMissing: 'Detail missing',
    charges: 'charges',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Manage your account, preferences, and integrations',
    tabGeneral: 'General',
    tabHousehold: 'Household',
    tabCategories: 'Categories',
    tabNotifications: 'Notifications',
    tabRules: 'Rules',
    generalTitle: 'General Settings',
    generalSub: 'Customize your app experience',
    emailAddress: 'Email Address',
    currency: 'Preferred Currency',
    dateFormat: 'Date Format',
    saveChanges: 'Save Changes',
    inviteTitle: 'Invite Your Spouse',
    inviteSub:
      'Create a shared household account to view combined finances and sync spending data',
    spouseEmail: 'Spouse Email Address',
    sendInvite: 'Send Invite',
    membersTitle: 'Household Members',
    membersEmpty: 'Only you for now. Invite your spouse to get started!',
    categoryRules: 'Category Rules',
    categoryRulesSub: 'Customize how transactions are automatically categorized',
    addRule: 'Add New Rule',
    rulesTitle: 'Auto-Categorization Rules',
    rulesSub: 'When a merchant matches a rule, it is automatically categorized',
    noRules: 'No rules yet. Re-categorize a transaction to create one automatically.',
    deleteRule: 'Delete Rule',
    customCategories: 'Custom Categories',
    customCategoriesSub: 'Add, edit, or remove your custom categories',
    noCustomCategories: 'No custom categories. Add one from the transactions page.',
    deleteCategory: 'Delete Category',
    editCategory: 'Edit Category',
    builtInBadge: 'Built-in',
    customBadge: 'Custom',
    addCategory: 'Add New Category',
    addCategoryTitle: 'Add New Category',
    editCategoryTitle: 'Edit Category',
    categoryName: 'Category Name',
    categoryType: 'Classification Type',
    saveCategory: 'Save',
    cancelCategory: 'Cancel',
    addRuleTitle: 'Add New Rule',
    merchantName: 'Merchant Name',
    targetCategory: 'Associated Category',
    selectCategory: 'Select a category...',
    saveRule: 'Save',
    cancelRule: 'Cancel',
    notifTitle: 'Notification Preferences',
    notifSub: "Choose what notifications you'd like to receive",
    notifBudget: 'Budget Alerts',
    notifBudgetDesc: 'Notify when spending exceeds budget',
    notifWeekly: 'Weekly Summary',
    notifWeeklyDesc: 'Get a weekly summary of your spending',
    notifNew: 'New Transactions',
    notifNewDesc: 'Notify when new transactions are imported',
    savePrefs: 'Save Preferences',
  },
  categories: {
    Housing: 'Housing',
    Utilities: 'Utilities',
    Transportation: 'Transportation',
    'Food & Shopping': 'Food & Shopping',
    Health: 'Health',
    Entertainment: 'Entertainment',
    'Clothing & Footwear': 'Clothing & Footwear',
    'Travel & Vacation': 'Travel & Vacation',
    Subscriptions: 'Subscriptions',
    Education: 'Education',
    'Emergency Fund': 'Emergency Fund',
    'Long-term Savings': 'Long-term Savings',
    'Debt Repayment': 'Debt Repayment',
    Income: 'Income',
    Other: 'Other',
  },
};

const he: Dict = {
  common: { appName: 'ElastiCash', loading: 'טוען...' },
  nav: {
    dashboard: 'לוח בקרה',
    upload: 'העלאה',
    transactions: 'עסקאות',
    settings: 'הגדרות',
    logout: 'התנתקות',
    switchTo: 'EN',
  },
  login: {
    title: 'התחברות',
    subtitle: 'נהל את הכספים שלך בקלות',
    email: 'אימייל',
    password: 'סיסמה',
    signIn: 'התחברות',
    signingIn: 'מתחבר...',
    noAccount: 'אין לך חשבון?',
    signUp: 'הרשמה',
    demo: 'מצב הדגמה: כל אימייל/סיסמה יעבדו',
    failed: 'ההתחברות נכשלה',
    error: 'אירעה שגיאה. נסה שוב.',
  },
  signup: {
    title: 'הרשמה',
    subtitle: 'התחל לעקוב אחר הכספים שלך',
    fullName: 'שם מלא',
    fullNamePlaceholder: 'ישראל ישראלי',
    email: 'אימייל',
    password: 'סיסמה',
    confirmPassword: 'אימות סיסמה',
    createAccount: 'יצירת חשבון',
    creatingAccount: 'יוצר חשבון...',
    haveAccount: 'כבר יש לך חשבון?',
    signIn: 'התחברות',
    demo: 'מצב הדגמה: כל ההרשמות נוצרות מיידית',
    mismatch: 'הסיסמאות אינן תואמות',
    failed: 'ההרשמה נכשלה',
    error: 'אירעה שגיאה. נסה שוב.',
  },
  dashboard: {
    title: 'לוח בקרה',
    subtitle: 'עקוב אחר הכספים ודפוסי ההוצאות שלך במבט אחד',
    totalIncome: 'סך הכנסות',
    totalExpenses: 'סך הוצאות',
    totalSavings: 'סך חיסכון',
    savingsRate: 'שיעור חיסכון',
    pctOfIncome: '{pct}% מההכנסה',
    thisMonth: 'החודש',
    topCategories: 'קטגוריות הוצאה מובילות',
    last30: '30 הימים האחרונים',
    pctOfExpenses: '{pct}% מההוצאות',
    summary: 'סיכום',
    income: 'הכנסות',
    fixed: 'הוצאות קבועות',
    variable: 'הוצאות משתנות',
    savingsDebt: 'חיסכון והחזרים',
    netSavings: 'חיסכון נטו',
    noData: 'אין נתונים עדיין',
    noDataSub: 'התחל בהעלאת הקובץ הראשון שלך',
    uploadFile: 'העלאת קובץ',
    ctaTitle: 'מוכן להוסיף עוד נתונים?',
    ctaSub: 'העלה עסקאות ממקורות שונים כדי לקבל תמונה מלאה של הכספים שלך',
    uploadNew: 'העלאת קובץ חדש',
    periodLastMonth: 'חודש אחרון',
    periodLast3: '3 חודשים',
    periodLast6: '6 חודשים',
    periodLastYear: 'שנה',
    periodAll: 'הכל',
    periodCustom: 'מותאם',
  },
  upload: {
    title: 'העלאת עסקאות',
    subtitle: 'ייבא דפי בנק או ייצוא משירותי תשלום כדי לנתח את ההוצאות שלך',
    selectSource: 'בחר מקור נתונים',
    fileLabel: 'העלאת קובץ',
    dragDrop: 'גרור ושחרר קבצים כאן',
    orClick: 'או לחץ לבחירה • תומך בקבצי CSV ו-Excel',
    selected: 'נבחר: {name}',
    filesSelected: '{count} קבצים נבחרו',
    removeFile: 'הסר קובץ',
    processing: 'מעבד...',
    uploadProcess: 'העלאה ועיבוד',
    previewTitle: 'תצוגה מקדימה (5 העסקאות הראשונות)',
    thDate: 'תאריך',
    thMerchant: 'בית עסק',
    thAmount: 'סכום',
    thCategory: 'קטגוריה',
    uncategorized: 'לא מסווג',
    errorSelect: 'אנא בחר לפחות קובץ אחד',
    errorUpload: 'שגיאה בהעלאת הקובץ',
    error: 'אירעה שגיאה',
    success: '✓ הקובץ עובד בהצלחה! נשמרו {count} עסקאות',
    successMulti: '✓ {files} קבצים עובדו בהצלחה! נשמרו {count} עסקאות',
    info1Title: 'פורמטים נתמכים',
    info1Desc: 'קבצי CSV ו-Excel מכל בנק או שירות תשלום',
    info2Title: 'מאובטח ופרטי',
    info2Desc: 'כל העסקאות מעובדות בצורה מאובטחת ומוצפנת',
    info3Title: 'סיווג אוטומטי',
    info3Desc: 'העסקאות מסווגות אוטומטית וניתנות לעריכה',
  },
  sources: {
    bank: 'בנק',
    bit: 'ביט',
    paypal: 'PayPal',
    google_pay: 'Google Pay',
    apple_pay: 'Apple Pay',
    credit_card: 'כרטיס אשראי',
  },
  transactions: {
    title: 'עסקאות',
    subtitle: 'סקור, סנן ונהל את העסקאות שלך',
    search: 'חיפוש לפי בית עסק...',
    allCategories: 'כל הקטגוריות',
    allTypes: 'כל הסוגים',
    fixed: 'קבועות',
    variable: 'משתנות',
    savingsDebt: 'חיסכון והחזרים',
    income: 'הכנסות',
    thDate: 'תאריך',
    thMerchant: 'בית עסק',
    thAmount: 'סכום',
    thCategory: 'קטגוריה',
    thType: 'סוג',
    thSource: 'מקור',
    none: 'לא נמצאו עסקאות',
    totalTransactions: 'סך עסקאות',
    totalAmount: 'סכום כולל',
    avgTransaction: 'עסקה ממוצעת',
    reCategorize: 'לחץ לשינוי קטגוריה',
    addCategory: 'הוסף קטגוריה',
    addCategoryTitle: 'הוספת קטגוריה חדשה',
    categoryName: 'שם הקטגוריה',
    categoryType: 'סוג הקטגוריה',
    save: 'שמור',
    cancel: 'ביטול',
    detailMissing: 'פירוט חסר',
    charges: 'חיובים',
  },
  settings: {
    title: 'הגדרות',
    subtitle: 'נהל את החשבון, ההעדפות והאינטגרציות שלך',
    tabGeneral: 'כללי',
    tabHousehold: 'משק בית',
    tabCategories: 'קטגוריות',
    tabNotifications: 'התראות',
    tabRules: 'חוקים',
    generalTitle: 'הגדרות כלליות',
    generalSub: 'התאם את חוויית השימוש שלך',
    emailAddress: 'כתובת אימייל',
    currency: 'מטבע מועדף',
    dateFormat: 'פורמט תאריך',
    saveChanges: 'שמירת שינויים',
    inviteTitle: 'הזמן את בן/בת הזוג',
    inviteSub:
      'צור חשבון משק בית משותף לצפייה בכספים משולבים וסנכרון נתוני הוצאות',
    spouseEmail: 'אימייל בן/בת הזוג',
    sendInvite: 'שליחת הזמנה',
    membersTitle: 'חברי משק הבית',
    membersEmpty: 'רק אתה בינתיים. הזמן את בן/בת הזוג כדי להתחיל!',
    categoryRules: 'כללי קטגוריות',
    categoryRulesSub: 'התאם כיצד עסקאות מסווגות אוטומטית',
    addRule: 'הוספת כלל חדש',
    rulesTitle: 'חוקי שיוך אוטומטי',
    rulesSub: 'כשבית עסק תואם חוק, הוא משויך לקטגוריה אוטומטית',
    noRules: 'אין חוקים עדיין. שנה קטגוריה של עסקה כדי ליצור חוק אוטומטית.',
    deleteRule: 'מחיקת חוק',
    customCategories: 'קטגוריות מותאמות',
    customCategoriesSub: 'הוסף, ערוך או הסר קטגוריות מותאמות אישית',
    noCustomCategories: 'אין קטגוריות מותאמות. הוסף אחת מעמוד העסקאות.',
    deleteCategory: 'מחיקת קטגוריה',
    editCategory: 'עריכת קטגוריה',
    builtInBadge: 'מובנה',
    customBadge: 'מותאם',
    addCategory: 'הוספת קטגוריה חדשה',
    addCategoryTitle: 'הוספת קטגוריה חדשה',
    editCategoryTitle: 'עריכת קטגוריה',
    categoryName: 'שם הקטגוריה',
    categoryType: 'סוג סיווג',
    saveCategory: 'שמור',
    cancelCategory: 'ביטול',
    addRuleTitle: 'הוספת חוק חדש',
    merchantName: 'שם בית עסק',
    targetCategory: 'קטגוריה משויכת',
    selectCategory: 'בחר קטגוריה...',
    saveRule: 'שמור',
    cancelRule: 'ביטול',
    notifTitle: 'העדפות התראות',
    notifSub: 'בחר אילו התראות תרצה לקבל',
    notifBudget: 'התראות תקציב',
    notifBudgetDesc: 'קבל התראה כשההוצאות חורגות מהתקציב',
    notifWeekly: 'סיכום שבועי',
    notifWeeklyDesc: 'קבל סיכום שבועי של ההוצאות שלך',
    notifNew: 'עסקאות חדשות',
    notifNewDesc: 'קבל התראה כשמיובאות עסקאות חדשות',
    savePrefs: 'שמירת העדפות',
  },
  categories: {
    Housing: 'דיור',
    Utilities: 'חשבונות שוטפים',
    Transportation: 'תחבורה והחזקת רכב',
    'Food & Shopping': 'מזון וקניות',
    Health: 'בריאות',
    Entertainment: 'פנאי ובילויים',
    'Clothing & Footwear': 'ביגוד והנעלה',
    'Travel & Vacation': 'טיולים ונופש',
    Subscriptions: 'מנויים',
    Education: 'חינוך וחוגים',
    'Emergency Fund': 'קרן חירום',
    'Long-term Savings': 'חסכונות ארוכי טווח',
    'Debt Repayment': 'החזר חובות',
    Income: 'הכנסות',
    Other: 'אחר',
  },
};

const dictionaries: Record<Lang, Dict> = { en, he };

function resolve(dict: Dict, key: string): unknown {
  return key.split('.').reduce<any>((obj, part) => obj?.[part], dict);
}

export type TFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

interface I18nValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: TFunction;
  // Default display currency is the Israeli Shekel (ILS / ₪). Amounts are
  // stored as raw numbers; multi-currency conversion is a Phase 2 item.
  formatMoney: (amount: number) => string;
  formatDate: (date: string | Date) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to Hebrew (RTL). Deterministic on first render to avoid
  // hydration mismatches; localStorage is read after mount.
  const [lang, setLangState] = useState<Lang>('he');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'he' || saved === 'en') setLangState(saved);
  }, []);

  const dir: 'rtl' | 'ltr' = lang === 'he' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('lang', next);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'he' ? 'en' : 'he';
      try {
        localStorage.setItem('lang', next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const t = useCallback<TFunction>(
    (key, params) => {
      const raw = resolve(dictionaries[lang], key);
      if (typeof raw !== 'string') return key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name) =>
        String(params[name] ?? '')
      );
    },
    [lang]
  );

  const locale = lang === 'he' ? 'he-IL' : 'en-US';

  const formatMoney = useCallback(
    (amount: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'ILS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount),
    [locale]
  );

  const formatDate = useCallback(
    (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{ lang, dir, setLang, toggle, t, formatMoney, formatDate }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within a LanguageProvider');
  }
  return ctx;
}

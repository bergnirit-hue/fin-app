export type ClassificationType = 'fixed' | 'variable' | 'savings_debt' | 'income';

export interface ClassificationMap {
  [category: string]: ClassificationType;
}

export const DEFAULT_CLASSIFICATIONS: ClassificationMap = {
  // Fixed Expenses — recurring, hard to reduce short-term
  Housing: 'fixed',
  Utilities: 'fixed',
  Transportation: 'fixed',

  // Variable Expenses — fluctuate monthly, easier to cut
  'Food & Shopping': 'variable',
  Health: 'variable',
  Entertainment: 'variable',
  'Clothing & Footwear': 'variable',
  'Travel & Vacation': 'variable',
  Subscriptions: 'variable',
  Education: 'variable',

  // Savings & Debt — allocations for the future / existing loans
  'Emergency Fund': 'savings_debt',
  'Long-term Savings': 'savings_debt',
  'Debt Repayment': 'savings_debt',

  // Income
  Income: 'income',

  // Default
  Other: 'variable',
};

export class ClassificationEngine {
  private classifications: ClassificationMap;

  constructor(customClassifications?: Partial<ClassificationMap>) {
    this.classifications = {
      ...DEFAULT_CLASSIFICATIONS,
      ...(customClassifications || {}),
    } as ClassificationMap;
  }

  classify(category: string): ClassificationType {
    return this.classifications[category] || 'variable';
  }

  setClassification(
    category: string,
    type: ClassificationType
  ): void {
    this.classifications[category] = type;
  }

  getClassifications(): ClassificationMap {
    return { ...this.classifications };
  }

  getCategories(type: ClassificationType): string[] {
    return Object.entries(this.classifications)
      .filter(([, classType]) => classType === type)
      .map(([category]) => category);
  }
}

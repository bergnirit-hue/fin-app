export type ClassificationType = 'must_have' | 'luxury';

export interface ClassificationMap {
  [category: string]: ClassificationType;
}

export const DEFAULT_CLASSIFICATIONS: ClassificationMap = {
  // Must-have expenses
  Groceries: 'must_have',
  Housing: 'must_have',
  Utilities: 'must_have',
  Transportation: 'must_have',
  Health: 'must_have',
  Insurance: 'must_have',
  Education: 'must_have',

  // Luxury/Extra expenses
  Dining: 'luxury',
  Entertainment: 'luxury',
  Shopping: 'luxury',
  Subscriptions: 'luxury',
  Travel: 'luxury',
  'Personal Care': 'luxury',
  Pets: 'luxury',
  Gifts: 'luxury',
  Office: 'luxury',

  // Default
  Other: 'luxury',
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
    return this.classifications[category] || 'luxury';
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

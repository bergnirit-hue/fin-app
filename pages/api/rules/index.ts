import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';

export interface RuleDTO {
  id: string;
  merchantPattern: string;
  targetCategory: string;
  isActive: boolean;
  createdAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.method === 'GET') {
    const rules = await prisma.categorizationRule.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    });

    const dtos: RuleDTO[] = rules.map((r) => ({
      id: r.id,
      merchantPattern: r.merchantPattern,
      targetCategory: r.targetCategory,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
    }));

    return res.status(200).json({ rules: dtos });
  }

  if (req.method === 'POST') {
    const merchantPattern = (req.body?.merchantPattern ?? '').toString().trim();
    const targetCategory = (req.body?.targetCategory ?? '').toString().trim();

    if (!merchantPattern || !targetCategory) {
      return res
        .status(400)
        .json({ message: 'merchantPattern and targetCategory are required' });
    }

    // Upsert: if a rule for this merchant already exists, update it
    const existing = await prisma.categorizationRule.findFirst({
      where: { userId: auth.userId, merchantPattern },
    });

    if (existing) {
      const updated = await prisma.categorizationRule.update({
        where: { id: existing.id },
        data: { targetCategory, isActive: true },
      });
      return res.status(200).json({
        rule: {
          id: updated.id,
          merchantPattern: updated.merchantPattern,
          targetCategory: updated.targetCategory,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    }

    const created = await prisma.categorizationRule.create({
      data: {
        userId: auth.userId,
        merchantPattern,
        targetCategory,
      },
    });

    return res.status(201).json({
      rule: {
        id: created.id,
        merchantPattern: created.merchantPattern,
        targetCategory: created.targetCategory,
        isActive: created.isActive,
        createdAt: created.createdAt.toISOString(),
      },
    });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

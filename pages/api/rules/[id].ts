import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid id' });
  }

  if (req.method === 'DELETE') {
    const existing = await prisma.categorizationRule.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    await prisma.categorizationRule.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT') {
    const existing = await prisma.categorizationRule.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    const targetCategory = (req.body?.targetCategory ?? '').toString().trim();
    const isActive = req.body?.isActive;

    const updated = await prisma.categorizationRule.update({
      where: { id },
      data: {
        ...(targetCategory ? { targetCategory } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
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

  return res.status(405).json({ message: 'Method not allowed' });
}

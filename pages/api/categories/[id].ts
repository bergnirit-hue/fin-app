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

  if (req.method === 'PUT') {
    const name = (req.body?.name ?? '').toString().trim();
    const classification = (req.body?.classification ?? '').toString().trim();

    const existing = await prisma.classification.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const updated = await prisma.classification.update({
      where: { id },
      data: {
        ...(name ? { category: name } : {}),
        ...(classification ? { type: classification } : {}),
      },
    });

    return res.status(200).json({
      category: {
        id: updated.id,
        name: updated.category,
        classification: updated.type,
        isCustom: true,
      },
    });
  }

  if (req.method === 'DELETE') {
    const existing = await prisma.classification.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await prisma.classification.delete({ where: { id } });

    // Also delete any rules pointing to this category
    await prisma.categorizationRule.deleteMany({
      where: { userId: auth.userId, targetCategory: existing.category },
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid transaction ID' });
  }

  const { notes } = req.body;
  if (typeof notes !== 'string' && notes !== null) {
    return res.status(400).json({ message: 'Notes must be a string or null' });
  }

  // Verify ownership
  const tx = await prisma.transaction.findFirst({
    where: { id, userId: auth.userId },
  });
  if (!tx) {
    return res.status(404).json({ message: 'Transaction not found' });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: { notes: notes?.trim() || null },
  });

  return res.status(200).json({
    id: updated.id,
    notes: updated.notes,
  });
}

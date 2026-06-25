import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest, createToken, setAuthCookie } from '@/lib/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const membership = await prisma.householdMember.findFirst({
      where: { userId: auth.userId },
      include: { household: { include: { members: true } } },
    });

    if (!membership) {
      return res.status(400).json({ success: false, message: 'You are not in a household' });
    }

    if (membership.role === 'admin' && membership.household.members.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Admin cannot leave while other members remain. Remove members first or transfer admin role.',
      });
    }

    await prisma.$transaction([
      prisma.householdMember.delete({ where: { id: membership.id } }),
      // Detach user's data from household
      prisma.transaction.updateMany({
        where: { userId: auth.userId, householdId: membership.householdId },
        data: { householdId: null },
      }),
      prisma.upload.updateMany({
        where: { userId: auth.userId, householdId: membership.householdId },
        data: { householdId: null },
      }),
    ]);

    // If admin is alone and leaving, delete the household
    if (membership.household.members.length === 1) {
      await prisma.household.delete({ where: { id: membership.householdId } });
    }

    // Refresh token without householdId
    const newToken = createToken({ userId: auth.userId, email: auth.email });
    setAuthCookie(res, newToken);

    return res.status(200).json({ success: true, message: 'Left the household' });
  } catch (error) {
    console.error('Leave household error:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
}

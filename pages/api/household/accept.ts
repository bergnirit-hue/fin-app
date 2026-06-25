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

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Invite token is required' });
  }

  try {
    const invite = await prisma.householdInvite.findUnique({
      where: { token },
      include: { household: true },
    });

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired invite' });
    }

    if (invite.email !== auth.email) {
      return res.status(403).json({ success: false, message: 'This invite was sent to a different email' });
    }

    const existingMembership = await prisma.householdMember.findFirst({
      where: { userId: auth.userId },
    });
    if (existingMembership) {
      return res.status(400).json({ success: false, message: 'You are already in a household. Leave your current household first.' });
    }

    await prisma.$transaction([
      prisma.householdMember.create({
        data: { householdId: invite.householdId, userId: auth.userId, role: 'member' },
      }),
      prisma.householdInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
      // Move the joining user's data into the household
      prisma.transaction.updateMany({
        where: { userId: auth.userId, householdId: null },
        data: { householdId: invite.householdId },
      }),
      prisma.upload.updateMany({
        where: { userId: auth.userId, householdId: null },
        data: { householdId: invite.householdId },
      }),
    ]);

    // Refresh token with householdId
    const newToken = createToken({
      userId: auth.userId,
      email: auth.email,
      householdId: invite.householdId,
    });
    setAuthCookie(res, newToken);

    return res.status(200).json({
      success: true,
      message: 'Successfully joined the household',
      household: { id: invite.household.id, name: invite.household.name },
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
}

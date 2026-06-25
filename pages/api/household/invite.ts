import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest, generateResetToken, createToken, setAuthCookie } from '@/lib/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  if (email === auth.email) {
    return res.status(400).json({ success: false, message: 'Cannot invite yourself' });
  }

  try {
    let membership = await prisma.householdMember.findFirst({
      where: { userId: auth.userId },
      include: { household: true },
    });

    let householdId: string;

    if (!membership) {
      const user = await prisma.user.findUnique({ where: { id: auth.userId } });
      const household = await prisma.household.create({
        data: {
          name: `${user?.name || auth.email}'s Household`,
          createdBy: auth.userId,
          members: {
            create: { userId: auth.userId, role: 'admin' },
          },
        },
      });
      householdId = household.id;

      // Reassign existing user data to the household
      await prisma.$transaction([
        prisma.transaction.updateMany({
          where: { userId: auth.userId, householdId: null },
          data: { householdId: household.id },
        }),
        prisma.upload.updateMany({
          where: { userId: auth.userId, householdId: null },
          data: { householdId: household.id },
        }),
        prisma.categorizationRule.updateMany({
          where: { userId: auth.userId, householdId: null },
          data: { householdId: household.id },
        }),
        prisma.classification.updateMany({
          where: { userId: auth.userId, householdId: null },
          data: { householdId: household.id },
        }),
      ]);

      // Refresh auth token with householdId
      const newToken = createToken({ userId: auth.userId, email: auth.email, householdId: household.id });
      setAuthCookie(res, newToken);
    } else {
      householdId = membership.householdId;
      if (membership.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can invite members' });
      }
    }

    const existingInvite = await prisma.householdInvite.findFirst({
      where: { householdId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      return res.status(400).json({ success: false, message: 'An invite for this email is already pending' });
    }

    const existingMember = await prisma.householdMember.findFirst({
      where: { householdId, user: { email } },
    });
    if (existingMember) {
      return res.status(400).json({ success: false, message: 'This user is already a member' });
    }

    const token = generateResetToken();
    const invite = await prisma.householdInvite.create({
      data: {
        householdId,
        email,
        invitedBy: auth.userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    console.log(`[Household Invite] Token for ${email}: ${token}`);

    return res.status(201).json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        token: process.env.NODE_ENV !== 'production' ? token : undefined,
      },
    });
  } catch (error) {
    console.error('Invite error:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
}

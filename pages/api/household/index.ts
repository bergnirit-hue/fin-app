import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.method === 'GET') {
    const membership = await prisma.householdMember.findFirst({
      where: { userId: auth.userId },
      include: {
        household: {
          include: {
            members: { include: { user: { select: { id: true, email: true, name: true } } } },
            invites: { where: { acceptedAt: null, expiresAt: { gt: new Date() } } },
          },
        },
      },
    });

    if (!membership) {
      return res.status(200).json({ success: true, household: null });
    }

    return res.status(200).json({
      success: true,
      household: {
        id: membership.household.id,
        name: membership.household.name,
        myRole: membership.role,
        members: membership.household.members.map((m) => ({
          userId: m.user.id,
          email: m.user.email,
          name: m.user.name,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        pendingInvites: membership.household.invites.map((i) => ({
          id: i.id,
          email: i.email,
          createdAt: i.createdAt,
        })),
      },
    });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

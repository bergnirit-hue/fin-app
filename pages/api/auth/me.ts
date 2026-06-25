import type { NextApiRequest, NextApiResponse } from 'next';
import { extractUserFromRequest } from '@/lib/utils/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const user = extractUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  return res.status(200).json({
    success: true,
    user: { userId: user.userId, email: user.email, householdId: user.householdId },
  });
}

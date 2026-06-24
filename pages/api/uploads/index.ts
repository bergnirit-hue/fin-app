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

  if (req.method === 'GET') {
    const uploads = await prisma.upload.findMany({
      where: { userId: auth.userId },
      select: {
        id: true,
        fileName: true,
        uploadDate: true,
        transactionCount: true,
        sourceType: true,
        billingTotal: true,
        cardLabel: true,
        fileSize: true,
        fileData: false, // never send blob to listing
      },
      orderBy: { uploadDate: 'desc' },
    });

    // Add hasFile flag
    const result = uploads.map((u) => ({
      ...u,
      hasFile: (u.fileSize ?? 0) > 0,
    }));

    return res.status(200).json(result);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

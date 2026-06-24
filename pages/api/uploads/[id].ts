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
    return res.status(400).json({ message: 'Invalid upload ID' });
  }

  const upload = await prisma.upload.findFirst({
    where: { id, userId: auth.userId },
  });
  if (!upload) {
    return res.status(404).json({ message: 'Upload not found' });
  }

  // ── GET: download original file ──
  if (req.method === 'GET') {
    if (!upload.fileData) {
      return res
        .status(404)
        .json({ message: 'Original file not available (uploaded before archive feature)' });
    }

    const ext = upload.fileName.toLowerCase();
    const contentType = ext.endsWith('.csv')
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(upload.fileName)}`
    );
    return res.send(Buffer.from(upload.fileData));
  }

  // ── DELETE: remove upload + its transactions ──
  if (req.method === 'DELETE') {
    // First unlink any transactions that point to this upload's transactions as parents
    const txIds = await prisma.transaction.findMany({
      where: { uploadId: id },
      select: { id: true },
    });
    const ids = txIds.map((t) => t.id);

    if (ids.length > 0) {
      // Unlink children that reference these transactions as linkedTo
      await prisma.transaction.updateMany({
        where: { linkedToId: { in: ids } },
        data: { linkedToId: null },
      });
    }

    // Delete the transactions
    await prisma.transaction.deleteMany({
      where: { uploadId: id },
    });

    // Delete the upload record
    await prisma.upload.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: `Deleted upload "${upload.fileName}" and ${upload.transactionCount} transactions`,
    });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

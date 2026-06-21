import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { DEFAULT_CLASSIFICATIONS } from '@/lib/core/classification';

export interface CategoryDTO {
  id?: string;
  name: string;
  classification: string; // "fixed" | "variable" | "savings_debt"
  isCustom: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.method === 'GET') {
    return handleGet(auth.userId, res);
  }

  if (req.method === 'POST') {
    return handlePost(auth.userId, req, res);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

async function handleGet(userId: string, res: NextApiResponse) {
  // Built-in categories
  const builtIn: CategoryDTO[] = Object.entries(DEFAULT_CLASSIFICATIONS).map(
    ([name, classification]) => ({
      name,
      classification,
      isCustom: false,
    })
  );

  // User-defined categories (from the classifications table)
  const custom = await prisma.classification.findMany({
    where: { userId },
  });

  const customDTOs: CategoryDTO[] = custom.map((c) => ({
    id: c.id,
    name: c.category,
    classification: c.type,
    isCustom: true,
  }));

  // Merge: custom overrides built-in if same name
  const customNames = new Set(customDTOs.map((c) => c.name));
  const merged = [
    ...builtIn.filter((b) => !customNames.has(b.name)),
    ...customDTOs,
  ].sort((a, b) => a.name.localeCompare(b.name));

  return res.status(200).json({ categories: merged });
}

async function handlePost(
  userId: string,
  req: NextApiRequest,
  res: NextApiResponse
) {
  const name = (req.body?.name ?? '').toString().trim();
  const classification = (req.body?.classification ?? '').toString().trim();

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }
  if (!['fixed', 'variable', 'savings_debt', 'income'].includes(classification)) {
    return res
      .status(400)
      .json({ message: 'classification must be "fixed", "variable", "savings_debt", or "income"' });
  }

  // Check if this category already exists for the user
  const existing = await prisma.classification.findFirst({
    where: { userId, category: name },
  });
  if (existing) {
    // Update classification type
    const updated = await prisma.classification.update({
      where: { id: existing.id },
      data: { type: classification },
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

  const created = await prisma.classification.create({
    data: {
      userId,
      category: name,
      type: classification,
    },
  });

  return res.status(201).json({
    category: {
      id: created.id,
      name: created.category,
      classification: created.type,
      isCustom: true,
    },
  });
}

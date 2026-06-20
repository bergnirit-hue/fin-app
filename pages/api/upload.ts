import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import * as XLSX from 'xlsx';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { TransactionParser, ColumnMapping } from '@/lib/core/parser';
import { DeduplicationEngine } from '@/lib/core/deduplication';
import { CategorizationEngine } from '@/lib/core/categorization';
import { ClassificationEngine } from '@/lib/core/classification';
import { findMatchingBankEntry } from '@/lib/core/reconciliation';

interface UploadResponse {
  success: boolean;
  message: string;
  transactions?: any[];
  transactionCount?: number;
  savedCount?: number;
  duplicateCount?: number;
  uploadId?: string;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// Build the dedup key used to detect transactions already in the DB.
// Mirrors the exact-match semantics in DeduplicationEngine (date + amount + merchant).
function dedupKey(date: Date, amount: number, merchant: string): string {
  return `${new Date(date).toDateString()}|${amount.toFixed(2)}|${merchant.trim()}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res
      .status(401)
      .json({ success: false, message: 'Authentication required' });
  }

  try {
    const form = new IncomingForm();

    const [fields, files] = await form.parse(req);

    const uploadedFile = files.file?.[0];
    if (!uploadedFile) {
      return res
        .status(400)
        .json({ success: false, message: 'No file provided' });
    }

    const buffer = fs.readFileSync(uploadedFile.filepath);
    const filename = uploadedFile.originalFilename || 'unknown';
    const sourceType = (fields.sourceType?.[0] || 'bank').toLowerCase();
    const columnMapping: ColumnMapping | null = fields.columnMapping
      ? JSON.parse(fields.columnMapping[0])
      : null;

    let parseResult;
    const ext = filename.toLowerCase();

    if (ext.endsWith('.csv')) {
      // Use the provided mapping, or auto-detect from the CSV headers.
      let mapping = columnMapping;
      if (!mapping) {
        const rows = await TransactionParser.readRawRows(buffer);
        mapping = TransactionParser.detectColumns(rows);
        if (!mapping) {
          console.error('Upload: column detection failed. Headers:', rows[0] ? Object.keys(rows[0]) : 'no rows');
          return res.status(400).json({
            success: false,
            message:
              'Could not auto-detect columns. Please check the file format.',
            transactions: [],
          });
        }
      }

      parseResult = await TransactionParser.parseCSV(
        buffer,
        mapping,
        sourceType
      );
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      // Use the provided mapping, or auto-detect from the Excel headers.
      // Israeli bank exports often have title/summary rows above the real
      // data table, so readExcelSheet scans for the header row automatically.
      let mapping = columnMapping;
      if (!mapping) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const result = TransactionParser.readExcelSheet(workbook);
        mapping = result.mapping;
        if (!mapping) {
          console.error('Upload: column detection failed. Headers:', result.data[0] ? Object.keys(result.data[0] as any) : 'no rows');
          return res.status(400).json({
            success: false,
            message:
              'Could not auto-detect columns. Please check the file format.',
            transactions: [],
          });
        }
      }

      parseResult = await TransactionParser.parseExcel(
        buffer,
        mapping,
        sourceType
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file format. Use CSV or Excel.',
      });
    }

    console.log(`Upload: parsed ${parseResult.transactions.length} rows from "${filename}"`);
    if (parseResult.transactions.length === 0) {
      console.error('Upload: 0 rows parsed. Mapping used:', parseResult.columnMapping);
    }

    // Deduplicate within the uploaded file (+ payment-service mapping)
    const dedupResult = DeduplicationEngine.deduplicateAndMap(
      parseResult.transactions
    );

    // Load user-defined categorization rules from DB (applied before defaults)
    const userRules = await prisma.categorizationRule.findMany({
      where: { userId: auth.userId, isActive: true },
    });
    const categorizer = new CategorizationEngine();
    // Prepend user rules so they take priority over built-in defaults
    for (const rule of userRules) {
      categorizer.addRule(rule.merchantPattern, rule.targetCategory);
    }
    const categorized = categorizer.categorizeMany(dedupResult.merged);

    // Load user-defined classifications from DB (applied on top of defaults)
    const userClassifications = await prisma.classification.findMany({
      where: { userId: auth.userId },
    });
    const classificationOverrides: Record<string, string> = {};
    for (const c of userClassifications) {
      classificationOverrides[c.category] = c.type;
    }
    const classifier = new ClassificationEngine(classificationOverrides);
    const classified = categorized.map((tx) => ({
      ...tx,
      classification: classifier.classify(tx.category),
    }));

    // Filter out rows that already exist in the DB for this user
    // (so re-uploading the same file does not create duplicates).
    const existing = await prisma.transaction.findMany({
      where: { userId: auth.userId },
      select: { date: true, amount: true, merchant: true },
    });
    const existingKeys = new Set(
      existing.map((t) => dedupKey(t.date, t.amount, t.merchant))
    );

    const toInsert: typeof classified = [];
    let duplicateCount = 0;
    for (const tx of classified) {
      const key = dedupKey(tx.date, tx.amount, tx.merchant);
      if (existingKeys.has(key)) {
        duplicateCount++;
        continue;
      }
      // Guard against duplicate keys within the same upload batch as well.
      existingKeys.add(key);
      toInsert.push(tx);
    }

    // Record the upload, then persist the new transactions linked to it.
    const upload = await prisma.upload.create({
      data: {
        userId: auth.userId,
        fileName: filename,
        sourceType,
        transactionCount: toInsert.length,
      },
    });

    if (toInsert.length > 0) {
      await prisma.transaction.createMany({
        data: toInsert.map((tx) => ({
          userId: auth.userId,
          uploadId: upload.id,
          date: tx.date,
          amount: tx.amount,
          merchant: tx.merchant,
          description: tx.description ?? null,
          category: tx.category,
          classification: tx.classification,
          sourceType: tx.sourceType,
        })),
      });
    }

    // ── Credit-card ↔ bank reconciliation ──────────────────────────
    // When a credit-card detail file is uploaded, try to match it to an
    // existing bank-statement lump-sum (e.g. "ישראכרט −₪5 000").  If
    // found, link the CC details to that bank row so they show as an
    // expandable drill-down and are excluded from summary totals.
    let linkedParentId: string | null = null;
    if (sourceType === 'credit_card' && toInsert.length > 0) {
      const ccTotal = toInsert.reduce(
        (sum, tx) => sum + Math.abs(tx.amount),
        0
      );
      const ccLatestDate = toInsert.reduce(
        (latest, tx) => (tx.date > latest ? tx.date : latest),
        toInsert[0].date
      );

      // Fetch unlinked negative bank transactions for this user.
      const bankCandidates = await prisma.transaction.findMany({
        where: {
          userId: auth.userId,
          sourceType: 'bank',
          linkedToId: null,
          amount: { lt: 0 },
        },
      });

      const match = findMatchingBankEntry(bankCandidates, ccTotal, ccLatestDate);
      if (match) {
        await prisma.transaction.updateMany({
          where: { uploadId: upload.id },
          data: { linkedToId: match.id },
        });
        linkedParentId = match.id;
        console.log(
          `Upload: linked ${toInsert.length} CC details to bank entry "${match.merchant}" (${match.id})`
        );
      }
    }

    return res.status(200).json({
      success: true,
      message:
        duplicateCount > 0
          ? `Saved ${toInsert.length} transactions (${duplicateCount} duplicates skipped)`
          : `Saved ${toInsert.length} transactions`,
      transactions: classified,
      transactionCount: classified.length,
      savedCount: toInsert.length,
      duplicateCount,
      uploadId: upload.id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing file',
    });
  }
}

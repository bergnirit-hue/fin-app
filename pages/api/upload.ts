import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import * as XLSX from 'xlsx';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { TransactionParser, ColumnMapping } from '@/lib/core/parser';
import { DeduplicationEngine } from '@/lib/core/deduplication';
import { CategorizationEngine } from '@/lib/core/categorization';
import { ClassificationEngine } from '@/lib/core/classification';

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

// Read CSV rows as raw objects (header-keyed) so we can auto-detect columns.
function readCsvRows(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    Readable.from([buffer])
      .pipe(csvParser())
      .on('data', (row: any) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

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

    if (filename.endsWith('.csv')) {
      // Use the provided mapping, or auto-detect from the CSV headers.
      let mapping = columnMapping;
      if (!mapping) {
        const rows = await readCsvRows(buffer);
        mapping = TransactionParser.detectColumns(rows);
        if (!mapping) {
          return res.status(200).json({
            success: true,
            message:
              'Could not auto-detect columns. Please map columns manually.',
            transactions: [],
          });
        }
      }

      parseResult = await TransactionParser.parseCSV(
        buffer,
        mapping,
        sourceType
      );
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      // Use the provided mapping, or auto-detect from the Excel headers.
      let mapping = columnMapping;
      if (!mapping) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        mapping = TransactionParser.detectColumns(rows as any[]);
        if (!mapping) {
          return res.status(200).json({
            success: true,
            message:
              'Could not auto-detect columns. Please confirm column mapping.',
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

    // Deduplicate within the uploaded file (+ payment-service mapping)
    const dedupResult = DeduplicationEngine.deduplicateAndMap(
      parseResult.transactions
    );

    // Categorize
    const categorizer = new CategorizationEngine();
    const categorized = categorizer.categorizeMany(dedupResult.merged);

    // Classify
    const classifier = new ClassificationEngine();
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

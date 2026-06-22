import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import * as XLSX from 'xlsx';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { TransactionParser, ColumnMapping } from '@/lib/core/parser';
import { DeduplicationEngine } from '@/lib/core/deduplication';
import { CategorizationEngine } from '@/lib/core/categorization';
import { ClassificationEngine, ClassificationType } from '@/lib/core/classification';
import { findMatchingBankEntry, looksLikeCreditCardFile } from '@/lib/core/reconciliation';
import { crossReference, detectPaymentService } from '@/lib/core/cross-reference';

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
    let sourceType = (fields.sourceType?.[0] || 'bank').toLowerCase();
    const columnMapping: ColumnMapping | null = fields.columnMapping
      ? JSON.parse(fields.columnMapping[0])
      : null;

    let parseResult;
    let fileHeaders: string[] = [];
    let billingTotal: number | null = null;
    let cardLabel: string | null = null;
    const ext = filename.toLowerCase();

    if (ext.endsWith('.csv')) {
      // Use the provided mapping, or auto-detect from the CSV headers.
      let mapping = columnMapping;
      let rawRows: any[] | null = null;
      if (!mapping) {
        rawRows = await TransactionParser.readRawRows(buffer);
        fileHeaders = rawRows[0] ? Object.keys(rawRows[0]) : [];

        // Try Bit-specific format first
        const bitMapping = TransactionParser.detectBitFormat(fileHeaders);
        if (bitMapping) {
          mapping = bitMapping;
          sourceType = 'bit';
          rawRows = TransactionParser.filterBitRows(rawRows);
          console.log(`Upload: detected Bit format, ${rawRows.length} rows after status filter`);
        } else {
          mapping = TransactionParser.detectColumns(rawRows);
        }

        if (!mapping) {
          console.error('Upload: column detection failed. Headers:', fileHeaders);
          return res.status(400).json({
            success: false,
            message:
              'Could not auto-detect columns. Please check the file format.',
            transactions: [],
          });
        }
      }

      // Auto-detect credit-card files based on column headers, even if the
      // user selected "bank" as the source type.
      if (sourceType !== 'credit_card' && looksLikeCreditCardFile(fileHeaders)) {
        sourceType = 'credit_card';
        console.log('Upload: auto-detected credit-card file from headers');
      }

      // For Bit files we already have filtered rows; parse them directly.
      if (rawRows && sourceType === 'bit') {
        const transactions = rawRows
          .map((row: any) => {
            const date = (TransactionParser as any).parseDate(row[mapping!.dateColumn]);
            const amount = (TransactionParser as any).parseAmount(row[mapping!.amountColumn!]);
            if (!date || amount === null) return null;
            const merchant = String(row[mapping!.merchantColumn] ?? '').trim();
            const description = mapping!.descriptionColumn
              ? String(row[mapping!.descriptionColumn] ?? '').trim() || undefined
              : undefined;
            return { date, amount, merchant, description, sourceType: 'bit' };
          })
          .filter((t: any): t is NonNullable<typeof t> => t !== null);
        parseResult = { transactions, columnMapping: mapping };
      } else {
        parseResult = await TransactionParser.parseCSV(
          buffer,
          mapping,
          sourceType
        );
      }
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      // Use the provided mapping, or auto-detect from the Excel headers.
      // Israeli bank exports often have title/summary rows above the real
      // data table, so readExcelSheet scans for the header row automatically.
      let mapping = columnMapping;
      if (!mapping) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const result = TransactionParser.readExcelSheet(workbook);
        mapping = result.mapping;
        billingTotal = result.billingTotal;
        cardLabel = result.cardLabel;
        fileHeaders = result.data[0] ? Object.keys(result.data[0] as any) : [];
        if (!mapping) {
          console.error('Upload: column detection failed. Headers:', fileHeaders);
          return res.status(400).json({
            success: false,
            message:
              'Could not auto-detect columns. Please check the file format.',
            transactions: [],
          });
        }
      }

      // Auto-detect credit-card files based on column headers.
      if (sourceType !== 'credit_card' && looksLikeCreditCardFile(fileHeaders)) {
        sourceType = 'credit_card';
        console.log('Upload: auto-detected credit-card file from headers');
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

    // ── Same-file overwrite ──────────────────────────────────────
    // When the same filename is uploaded again by the same user, treat it
    // as a replacement: delete the old upload's transactions so the new
    // data takes their place (avoids duplicates when re-importing after a
    // column-mapping change, for example).
    const previousUploads = await prisma.upload.findMany({
      where: { userId: auth.userId, fileName: filename },
    });
    if (previousUploads.length > 0) {
      const prevIds = previousUploads.map((u) => u.id);

      // If old CC details were linked to bank entries, clear the card
      // label from those parent entries so reconciliation can re-set it.
      const oldLinked = await prisma.transaction.findMany({
        where: { uploadId: { in: prevIds }, linkedToId: { not: null } },
        select: { linkedToId: true },
        distinct: ['linkedToId'],
      });
      const parentIds = oldLinked
        .map((t) => t.linkedToId!)
        .filter(Boolean);
      if (parentIds.length > 0) {
        await prisma.transaction.updateMany({
          where: { id: { in: parentIds } },
          data: { description: null },
        });
      }

      await prisma.transaction.deleteMany({
        where: { uploadId: { in: prevIds } },
      });
      await prisma.upload.deleteMany({
        where: { id: { in: prevIds } },
      });

      console.log(
        `Upload: replaced ${previousUploads.length} previous upload(s) of "${filename}"`
      );
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
    const classificationOverrides: Record<string, ClassificationType> = {};
    for (const c of userClassifications) {
      classificationOverrides[c.category] = c.type as ClassificationType;
    }
    const classifier = new ClassificationEngine(classificationOverrides);
    const classified = categorized.map((tx) => {
      const category = tx.amount > 0 ? 'Income' : tx.category;
      return {
        ...tx,
        category,
        classification: classifier.classify(category),
      };
    });

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
      // Prefer the billing total extracted from the file header
      // (e.g. "₪ 4,088.58") — this is the amount the bank actually debits.
      // The sum of all transactions in the file can be much larger because
      // CC files include installment payments from previous billing cycles.
      // Fall back to the net sum only when no header total was found (CSV
      // files, or non-standard Excel layouts).
      const ccTotal = billingTotal ?? Math.abs(
        toInsert.reduce((sum, tx) => sum + tx.amount, 0)
      );
      console.log(
        `Upload: CC reconciliation — billingTotal=${billingTotal}, txSum=${Math.abs(
          toInsert.reduce((sum, tx) => sum + tx.amount, 0)
        ).toFixed(2)}, using ccTotal=${ccTotal.toFixed(2)}`
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
        // Store the card label on the parent bank entry so the UI can
        // display it as a tag (e.g. "כרטיס 5560 ע״ש נירית ברג").
        if (cardLabel) {
          await prisma.transaction.update({
            where: { id: match.id },
            data: { description: cardLabel },
          });
        }
        linkedParentId = match.id;
        console.log(
          `Upload: linked ${toInsert.length} CC details to bank entry "${match.merchant}" (${match.id})` +
            (cardLabel ? ` — card: ${cardLabel}` : '')
        );
      }
    }

    // ── Payment-service cross-referencing ──────────────────────────
    // When a Bit/PayPal/etc. file is uploaded, find existing bank
    // proxies (e.g. "Bit Payment") AND CC detail rows (e.g. "העברה בBIT")
    // and enrich them with data from the payment-service export.
    let crossRefCount = 0;
    const paymentService = detectPaymentService(sourceType, filename);
    if (paymentService && toInsert.length > 0) {
      // Query both bank proxy rows and CC detail rows that mention the service
      const existingProxies = await prisma.transaction.findMany({
        where: {
          userId: auth.userId,
          uploadId: { not: upload.id },
          OR: [
            { sourceType: 'bank' },
            { sourceType: 'credit_card' },
          ],
        },
        select: { id: true, date: true, amount: true, merchant: true, sourceType: true },
      });

      const psTransactions = toInsert.map((tx, i) => ({
        id: String(i),
        date: tx.date,
        amount: tx.amount,
        merchant: tx.merchant,
        description: tx.description,
      }));

      const xref = crossReference(existingProxies, psTransactions, paymentService);

      // Build a lookup of target sourceTypes for formatting
      const sourceTypeMap = new Map(
        existingProxies.map((t) => [t.id, t.sourceType])
      );

      for (const match of xref.matched) {
        const targetSourceType = sourceTypeMap.get(match.targetTransactionId);
        let newMerchant: string;
        let newDescription: string | undefined;

        if (targetSourceType === 'credit_card') {
          // CC detail row: "העברה בBIT" → "העברת ביט - טיפול 10"
          const label = match.psDescription || match.psMerchant;
          newMerchant = `העברת ביט - ${label}`;
          newDescription = match.psMerchant;
        } else {
          // Bank proxy row: "Bit Payment" → real merchant name
          newMerchant = match.psMerchant;
          newDescription = `${paymentService} → ${match.psMerchant}`;
        }

        await prisma.transaction.update({
          where: { id: match.targetTransactionId },
          data: { merchant: newMerchant, description: newDescription },
        });
      }

      crossRefCount = xref.matched.length;
      if (crossRefCount > 0) {
        console.log(
          `Upload: cross-referenced ${crossRefCount} "${paymentService}" entries with real recipients`
        );
      }
      if (xref.unmatched.length > 0) {
        console.log(
          `Upload: ${xref.unmatched.length} ${paymentService} transactions had no matching bank/CC entry`
        );
      }
    }

    const enrichMsg = crossRefCount > 0
      ? ` (${crossRefCount} entries enriched via ${paymentService})`
      : '';

    return res.status(200).json({
      success: true,
      message:
        duplicateCount > 0
          ? `Saved ${toInsert.length} transactions (${duplicateCount} duplicates skipped)${enrichMsg}`
          : `Saved ${toInsert.length} transactions${enrichMsg}`,
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

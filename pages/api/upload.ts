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

const CC_FILENAME_PATTERNS = [
  /פירוט.*חיוב/i,       // "פירוט חיובים..." — charge detail
  /חיוב.*כרטיס/i,       // "חיובים לכרטיס..." — charges for card
  /כרטיס.*מאסטרקארד/i,  // "כרטיס מאסטרקארד" — Mastercard card
  /כרטיס.*ויזה/i,       // "כרטיס ויזה" — Visa card
  /כרטיס.*אמריקן/i,     // "כרטיס אמריקן" — Amex card
  /\bcal\b/i,            // Cal (כאל)
  /isracard/i,           // Isracard
  /leumi.?card/i,        // Leumi Card
];

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

      // Auto-detect credit-card files from headers or filename.
      if (sourceType !== 'credit_card') {
        if (looksLikeCreditCardFile(fileHeaders)) {
          sourceType = 'credit_card';
          console.log('Upload: auto-detected credit-card file from headers');
        } else if (CC_FILENAME_PATTERNS.some((re) => re.test(filename))) {
          sourceType = 'credit_card';
          console.log('Upload: auto-detected credit-card file from filename');
        }
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
            const paymentMethod: string | undefined = row.__paymentMethod || undefined;
            return { date, amount, merchant, description, sourceType: 'bit', paymentMethod };
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

      // Auto-detect credit-card files from headers, filename, or metadata.
      if (sourceType !== 'credit_card') {
        if (looksLikeCreditCardFile(fileHeaders)) {
          sourceType = 'credit_card';
          console.log('Upload: auto-detected credit-card file from headers');
        } else if (CC_FILENAME_PATTERNS.some((re) => re.test(filename))) {
          sourceType = 'credit_card';
          console.log('Upload: auto-detected credit-card file from filename');
        } else if (billingTotal != null || cardLabel != null) {
          sourceType = 'credit_card';
          console.log('Upload: auto-detected credit-card file from metadata (billingTotal/cardLabel)');
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

    // ── Payment-service: split CC-paid from standalone ─────────────
    // Bit/PayPal transactions paid via credit card are the SAME charge
    // that appears in a CC statement.  To avoid double-counting:
    //  • CC-paid rows are used to enrich existing CC detail rows, then
    //    discarded (not saved as standalone transactions).
    //  • If no matching CC detail exists yet, they're saved as hidden
    //    (isDuplicate=true) so a future CC upload can auto-match them.
    //  • Balance / bank-account rows are genuine standalone expenses.
    const paymentService = detectPaymentService(sourceType, filename);
    const CC_PAYMENT_METHODS = ['כרטיס אשראי', 'credit card'];

    let ccPaidRows: typeof classified = [];
    let standaloneTx: typeof classified;

    if (paymentService) {
      standaloneTx = [];
      for (const tx of toInsert) {
        const pm = (tx as any).paymentMethod?.toLowerCase() ?? '';
        if (CC_PAYMENT_METHODS.some((m) => pm.includes(m))) {
          ccPaidRows.push(tx);
        } else {
          standaloneTx.push(tx);
        }
      }
      console.log(
        `Upload: ${paymentService} — ${standaloneTx.length} standalone, ${ccPaidRows.length} CC-paid`
      );
    } else {
      standaloneTx = toInsert;
    }

    // Record the upload, then persist standalone transactions.
    const upload = await prisma.upload.create({
      data: {
        user: { connect: { id: auth.userId } },
        fileName: filename,
        sourceType,
        transactionCount: standaloneTx.length + ccPaidRows.length,
        ...(billingTotal != null ? { billingTotal } : {}),
        ...(cardLabel != null ? { cardLabel } : {}),
      },
    });

    if (standaloneTx.length > 0) {
      await prisma.transaction.createMany({
        data: standaloneTx.map((tx) => ({
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

    // ── Forward reconciliation: bank upload → unlinked CC groups ────
    // When a bank file is uploaded, try to link existing CC uploads that
    // couldn't find a bank parent at their upload time.
    let forwardReconcileCount = 0;
    if (sourceType === 'bank' && standaloneTx.length > 0) {
      const newBankRows = await prisma.transaction.findMany({
        where: {
          uploadId: upload.id,
          amount: { lt: 0 },
        },
      });

      // Find CC uploads that have unlinked rows (no linkedToId set).
      const unlnkCcRows = await prisma.transaction.findMany({
        where: {
          userId: auth.userId,
          linkedToId: null,
          uploadId: { not: upload.id },
        },
        select: { id: true, date: true, amount: true, uploadId: true },
      });

      // Only consider uploads whose sourceType is credit_card.
      const ccUploads = await prisma.upload.findMany({
        where: { userId: auth.userId, sourceType: 'credit_card' },
        select: { id: true, billingTotal: true, cardLabel: true },
      });
      const ccUploadMap = new Map(ccUploads.map((u) => [u.id, u]));

      // Group by uploadId — each CC upload is one billing cycle.
      const byUpload = new Map<string, typeof unlnkCcRows>();
      for (const row of unlnkCcRows) {
        if (!row.uploadId || !ccUploadMap.has(row.uploadId)) continue;
        if (!byUpload.has(row.uploadId)) byUpload.set(row.uploadId, []);
        byUpload.get(row.uploadId)!.push(row);
      }

      for (const [ccUploadId, ccRows] of byUpload) {
        const storedBilling = ccUploadMap.get(ccUploadId)?.billingTotal;
        const ccTotal = storedBilling ?? Math.abs(ccRows.reduce((s, r) => s + r.amount, 0));
        const storedCardLabel = ccUploadMap.get(ccUploadId)?.cardLabel;
        const ccLatestDate = ccRows.reduce(
          (latest, r) => (r.date > latest ? r.date : latest),
          ccRows[0].date
        );

        const match = findMatchingBankEntry(newBankRows, ccTotal, ccLatestDate);
        if (match) {
          await prisma.transaction.updateMany({
            where: { uploadId: ccUploadId, linkedToId: null },
            data: { linkedToId: match.id },
          });
          if (storedCardLabel) {
            await prisma.transaction.update({
              where: { id: match.id },
              data: { description: storedCardLabel },
            });
          }
          // Remove matched bank row from candidates so it's not reused.
          const idx = newBankRows.findIndex((r) => r.id === match.id);
          if (idx !== -1) newBankRows.splice(idx, 1);
          forwardReconcileCount += ccRows.length;
          console.log(
            `Upload: forward-reconciled ${ccRows.length} CC details (upload ${ccUploadId}) → bank "${match.merchant}" (${match.id})`
          );
        }
      }
    }

    // ── Credit-card ↔ bank reconciliation ──────────────────────────
    let linkedParentId: string | null = null;
    if (sourceType === 'credit_card' && toInsert.length > 0) {
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

    // ── Payment-service → CC cross-referencing ──────────────────────
    // Enrich existing CC detail rows with data from the payment-service
    // file.  CC-paid PS rows that don't match are saved as hidden
    // (isDuplicate=true) for future reverse cross-referencing.
    let crossRefCount = 0;
    if (paymentService && ccPaidRows.length > 0) {
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

      const psTransactions = ccPaidRows.map((tx, i) => ({
        id: String(i),
        date: tx.date,
        amount: tx.amount,
        merchant: tx.merchant,
        description: tx.description,
      }));

      const xref = crossReference(existingProxies, psTransactions, paymentService);

      const sourceTypeMap = new Map(
        existingProxies.map((t) => [t.id, t.sourceType])
      );

      for (const match of xref.matched) {
        const targetSourceType = sourceTypeMap.get(match.targetTransactionId);
        const desc = match.psDescription || match.psMerchant;
        const label = match.psDescription
          ? `${paymentService}: ${match.psDescription} - ${match.psMerchant}`
          : `${paymentService}: ${match.psMerchant}`;

        if (targetSourceType === 'credit_card') {
          await prisma.transaction.update({
            where: { id: match.targetTransactionId },
            data: { merchant: label, sourceType: paymentService, description: desc },
          });
        } else {
          await prisma.transaction.update({
            where: { id: match.targetTransactionId },
            data: {
              merchant: match.psMerchant,
              description: `${paymentService} → ${match.psMerchant}`,
            },
          });
        }
      }

      crossRefCount = xref.matched.length;

      // Save unmatched CC-paid rows as hidden (isDuplicate=true) —
      // they'll be auto-matched when the CC statement is uploaded.
      const unmatchedCcPaid = xref.unmatched.map((u) => ccPaidRows[parseInt(u.id)]);
      if (unmatchedCcPaid.length > 0) {
        await prisma.transaction.createMany({
          data: unmatchedCcPaid.map((tx) => ({
            userId: auth.userId,
            uploadId: upload.id,
            date: tx.date,
            amount: tx.amount,
            merchant: tx.merchant,
            description: tx.description ?? null,
            category: tx.category,
            classification: tx.classification,
            sourceType: tx.sourceType,
            isDuplicate: true,
          })),
        });
        console.log(
          `Upload: ${unmatchedCcPaid.length} CC-paid ${paymentService} rows saved as hidden (pending CC match)`
        );
      }

      if (crossRefCount > 0) {
        console.log(
          `Upload: cross-referenced ${crossRefCount} "${paymentService}" CC entries`
        );
      }
    }

    // ── Reverse cross-ref: CC upload → pending PS rows ──────────────
    // When a CC statement is uploaded, check for hidden payment-service
    // rows (isDuplicate=true) that can now be matched to the new CC
    // detail rows, and enrich them automatically.
    let reverseCrossRefCount = 0;
    if (sourceType === 'credit_card' && toInsert.length > 0) {
      const pendingPsRows = await prisma.transaction.findMany({
        where: {
          userId: auth.userId,
          isDuplicate: true,
          sourceType: { in: ['bit', 'paypal', 'paybox'] },
        },
        select: { id: true, date: true, amount: true, merchant: true, description: true, sourceType: true },
      });

      if (pendingPsRows.length > 0) {
        // Newly saved CC rows — these are the targets to enrich.
        const newCcRows = await prisma.transaction.findMany({
          where: { uploadId: upload.id },
          select: { id: true, date: true, amount: true, merchant: true, sourceType: true },
        });

        // Group pending PS rows by service for separate cross-ref passes.
        const serviceGroups = new Map<string, typeof pendingPsRows>();
        for (const row of pendingPsRows) {
          const svc = row.sourceType;
          if (!serviceGroups.has(svc)) serviceGroups.set(svc, []);
          serviceGroups.get(svc)!.push(row);
        }

        for (const [svc, psRows] of serviceGroups) {
          // newCcRows = targets (contain "bit"/"paypal" in merchant)
          // psRows = sources (provide real merchant/description)
          const psCandidates = psRows.map((r) => ({
            ...r,
            description: r.description ?? undefined,
          }));
          const xref = crossReference(newCcRows, psCandidates, svc);

          for (const match of xref.matched) {
            // match.targetTransactionId = the CC row to enrich
            // match.psMerchant / psDescription = from the pending Bit row
            const label = match.psDescription
              ? `${svc}: ${match.psDescription} - ${match.psMerchant}`
              : `${svc}: ${match.psMerchant}`;

            await prisma.transaction.update({
              where: { id: match.targetTransactionId },
              data: { merchant: label, sourceType: svc, description: match.psDescription || match.psMerchant },
            });
          }

          // Delete the matched pending PS rows — their data has been
          // transferred to the CC detail rows.
          const unmatchedPsIdSet = new Set(xref.unmatched.map((u) => u.id));
          const matchedPsRowIds = psRows
            .filter((r) => !unmatchedPsIdSet.has(r.id))
            .map((r) => r.id);

          if (matchedPsRowIds.length > 0) {
            await prisma.transaction.deleteMany({
              where: { id: { in: matchedPsRowIds } },
            });
          }

          reverseCrossRefCount += xref.matched.length;
          if (xref.matched.length > 0) {
            console.log(
              `Upload: reverse cross-ref — enriched ${xref.matched.length} CC rows from pending ${svc} data`
            );
          }
        }
      }
    }

    const enrichMsg = crossRefCount > 0
      ? ` (${crossRefCount} entries enriched via ${paymentService})`
      : reverseCrossRefCount > 0
        ? ` (${reverseCrossRefCount} entries enriched via pending cross-ref)`
        : forwardReconcileCount > 0
          ? ` (${forwardReconcileCount} CC details linked to new bank entries)`
          : '';

    const savedCount = standaloneTx.length;
    return res.status(200).json({
      success: true,
      message:
        duplicateCount > 0
          ? `Saved ${savedCount} transactions (${duplicateCount} duplicates skipped)${enrichMsg}`
          : `Saved ${savedCount} transactions${enrichMsg}`,
      transactions: classified,
      transactionCount: classified.length,
      savedCount,
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

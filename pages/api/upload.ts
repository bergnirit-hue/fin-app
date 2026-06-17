import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import { TransactionParser, ColumnMapping } from '@/lib/core/parser';
import { DeduplicationEngine } from '@/lib/core/deduplication';
import { CategorizationEngine } from '@/lib/core/categorization';
import { ClassificationEngine } from '@/lib/core/classification';

interface UploadResponse {
  success: boolean;
  message: string;
  transactions?: any[];
  transactionCount?: number;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
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
    const columnMapping: ColumnMapping = fields.columnMapping
      ? JSON.parse(fields.columnMapping[0])
      : null;

    let parseResult;

    if (filename.endsWith('.csv')) {
      // Auto-detect columns if not provided
      let mapping = columnMapping;
      if (!mapping) {
        // For CSV, we need to detect columns
        // For now, return columns for user to select
        return res.status(200).json({
          success: true,
          message: 'Please map columns',
          transactions: [],
        });
      }

      parseResult = await TransactionParser.parseCSV(
        buffer,
        mapping,
        sourceType
      );
    } else if (
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls')
    ) {
      let mapping = columnMapping;
      if (!mapping) {
        // Auto-detect for Excel
        return res.status(200).json({
          success: true,
          message: 'Please confirm column mapping',
          transactions: [],
        });
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

    // Deduplicate
    const dedupResult = DeduplicationEngine.deduplicateAndMap(
      parseResult.transactions
    );

    // Categorize
    const categorizer = new CategorizationEngine();
    const categorized = categorizer.categorizeMany(
      dedupResult.merged
    );

    // Classify
    const classifier = new ClassificationEngine();
    const classified = categorized.map((tx) => ({
      ...tx,
      classification: classifier.classify(tx.category),
    }));

    return res.status(200).json({
      success: true,
      message: 'File processed successfully',
      transactions: classified,
      transactionCount: classified.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing file',
    });
  }
}

import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

export interface ColumnMapping {
  dateColumn: string;
  amountColumn: string;
  merchantColumn: string;
  descriptionColumn?: string;
}

export interface ParsedTransaction {
  date: Date;
  amount: number;
  merchant: string;
  description?: string;
  sourceType: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  columnMapping?: ColumnMapping;
}

export class TransactionParser {
  static async parseExcel(
    buffer: Buffer,
    mapping: ColumnMapping,
    sourceType: string = 'bank'
  ): Promise<ParseResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    const transactions: ParsedTransaction[] = data
      .map((row: any) => {
        const date = this.parseDate(row[mapping.dateColumn]);
        const amount = this.parseAmount(row[mapping.amountColumn]);

        if (!date || amount === null) return null as any;

        return {
          date,
          amount,
          merchant: String(row[mapping.merchantColumn] || '').trim(),
          description: mapping.descriptionColumn
            ? String(row[mapping.descriptionColumn] || '').trim()
            : undefined,
          sourceType,
        };
      })
      .filter((t: any): t is ParsedTransaction => t !== null);

    return { transactions, columnMapping: mapping };
  }

  static async parseCSV(
    buffer: Buffer,
    mapping: ColumnMapping,
    sourceType: string = 'bank'
  ): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const transactions: ParsedTransaction[] = [];
      const readable = Readable.from([buffer]);

      readable
        .pipe(csvParser())
        .on('data', (row: any) => {
          const date = this.parseDate(row[mapping.dateColumn]);
          const amount = this.parseAmount(row[mapping.amountColumn]);

          if (!date || amount === null) return;

          transactions.push({
            date,
            amount,
            merchant: String(row[mapping.merchantColumn] || '').trim(),
            description: mapping.descriptionColumn
              ? String(row[mapping.descriptionColumn] || '').trim()
              : undefined,
            sourceType,
          });
        })
        .on('end', () => {
          resolve({ transactions, columnMapping: mapping });
        })
        .on('error', reject);
    });
  }

  static detectColumns(data: any[]): ColumnMapping | null {
    if (data.length === 0) return null;

    const headers = Object.keys(data[0]);
    const dateColumn = headers.find((h) =>
      /date|transaction date|post date/i.test(h)
    );
    const amountColumn = headers.find((h) =>
      /amount|debit|credit|transaction amount/i.test(h)
    );
    const merchantColumn = headers.find((h) =>
      /merchant|description|vendor|payee/i.test(h)
    );

    if (!dateColumn || !amountColumn || !merchantColumn) {
      return null;
    }

    return {
      dateColumn,
      amountColumn,
      merchantColumn,
      descriptionColumn: headers.find((h) => /description|notes/i.test(h)),
    };
  }

  private static parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;

    if (typeof dateStr === 'number') {
      // Excel serial date
      return new Date((dateStr - 25569) * 86400 * 1000);
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private static parseAmount(amountStr: any): number | null {
    if (amountStr === null || amountStr === undefined) return null;

    let numStr = String(amountStr)
      .replace(/[^\d.\-,]/g, '')
      .replace(',', '');

    const amount = parseFloat(numStr);
    return isNaN(amount) ? null : amount;
  }
}

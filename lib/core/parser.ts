import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

export interface ColumnMapping {
  dateColumn: string;
  // Either a single signed-amount column, or a debit/credit pair
  // (as Israeli/European bank statements use, e.g. "חובה" / "זכות").
  amountColumn?: string;
  debitColumn?: string; // money out
  creditColumn?: string; // money in
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

    const transactions = data
      .map((row: any) => this.mapRow(row, mapping, sourceType))
      .filter((t): t is ParsedTransaction => t !== null);

    return { transactions, columnMapping: mapping };
  }

  static async parseCSV(
    buffer: Buffer,
    mapping: ColumnMapping,
    sourceType: string = 'bank'
  ): Promise<ParseResult> {
    const rows = await this.readRawRows(buffer);
    const transactions = rows
      .map((row) => this.mapRow(row, mapping, sourceType))
      .filter((t): t is ParsedTransaction => t !== null);

    return { transactions, columnMapping: mapping };
  }

  // Read CSV/TSV rows as header-keyed objects, auto-detecting the delimiter
  // (comma, tab, or semicolon — Israeli bank exports often use tab/semicolon
  // because amounts contain commas as thousands separators).
  static readRawRows(buffer: Buffer): Promise<any[]> {
    const separator = this.detectDelimiter(buffer);
    // Standard comma CSV uses '"' for quoting. Tab/semicolon files are
    // typically bank exports where '"' is literal text — notably the Hebrew
    // gershayim in abbreviations like בע"מ or רשל"צ — so disable quote
    // handling for them (a NUL quote char never matches).
    const options =
      separator === ','
        ? { separator }
        : { separator, quote: String.fromCharCode(0) };

    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      Readable.from([buffer])
        .pipe(csvParser(options))
        .on('data', (row: any) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  private static detectDelimiter(buffer: Buffer): string {
    const firstLine = buffer.toString('utf8').split(/\r?\n/)[0] || '';
    const candidates: Array<[string, number]> = [
      [',', (firstLine.match(/,/g) || []).length],
      ['\t', (firstLine.match(/\t/g) || []).length],
      [';', (firstLine.match(/;/g) || []).length],
    ];
    candidates.sort((a, b) => b[1] - a[1]);
    return candidates[0][1] > 0 ? candidates[0][0] : ',';
  }

  private static mapRow(
    row: any,
    mapping: ColumnMapping,
    sourceType: string
  ): ParsedTransaction | null {
    const date = this.parseDate(row[mapping.dateColumn]);
    const amount = this.extractAmount(row, mapping);

    if (!date || amount === null) return null;

    const description = mapping.descriptionColumn
      ? String(row[mapping.descriptionColumn] ?? '').trim() || undefined
      : undefined;

    return {
      date,
      amount,
      merchant: String(row[mapping.merchantColumn] ?? '').trim(),
      description,
      sourceType,
    };
  }

  // Resolve a signed amount from either a single amount column or a
  // debit/credit pair. Debit is money out (negative), credit is money in.
  private static extractAmount(
    row: any,
    mapping: ColumnMapping
  ): number | null {
    if (mapping.amountColumn) {
      return this.parseAmount(row[mapping.amountColumn]);
    }

    const debit = mapping.debitColumn
      ? this.parseAmount(row[mapping.debitColumn])
      : null;
    const credit = mapping.creditColumn
      ? this.parseAmount(row[mapping.creditColumn])
      : null;

    if (debit === null && credit === null) return null;
    return (credit ?? 0) - (debit ?? 0);
  }

  static detectColumns(data: any[]): ColumnMapping | null {
    if (!data || data.length === 0) return null;

    const headers = Object.keys(data[0]);
    const find = (re: RegExp) => headers.find((h) => re.test(h));

    const dateColumn = find(/date|תאריך/i);
    const merchantColumn = find(
      /merchant|description|vendor|payee|narrative|הפעולה|תיאור|שם|פרטים|לטובת/i
    );
    const debitColumn = find(/^debit$|חובה/i);
    const creditColumn = find(/^credit$|זכות/i);
    const amountColumn = find(/amount|סכום|transaction amount/i);
    const descriptionColumn = find(/description|notes|memo|פרטים|הערות/i);

    if (
      !dateColumn ||
      !merchantColumn ||
      (!amountColumn && !debitColumn && !creditColumn)
    ) {
      return null;
    }

    return {
      dateColumn,
      merchantColumn,
      ...(amountColumn ? { amountColumn } : {}),
      ...(debitColumn ? { debitColumn } : {}),
      ...(creditColumn ? { creditColumn } : {}),
      ...(descriptionColumn ? { descriptionColumn } : {}),
    };
  }

  private static parseDate(dateStr: any): Date | null {
    if (dateStr === null || dateStr === undefined || dateStr === '') {
      return null;
    }

    if (typeof dateStr === 'number') {
      // Excel serial date
      return new Date((dateStr - 25569) * 86400 * 1000);
    }

    const str = String(dateStr).trim();

    // Day-first formats common in IL/EU: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        // Use UTC midnight so the stored date matches the calendar date
        // regardless of server timezone (consistent with ISO parsing).
        const dt = new Date(Date.UTC(year, month - 1, day));
        return isNaN(dt.getTime()) ? null : dt;
      }
    }

    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private static parseAmount(amountStr: any): number | null {
    if (amountStr === null || amountStr === undefined) return null;

    // Keep digits, decimal point and sign; drop thousands separators,
    // currency symbols (₪, $) and whitespace.
    const numStr = String(amountStr).replace(/[^0-9.\-]/g, '');
    if (numStr === '' || numStr === '-' || numStr === '.') return null;

    const amount = parseFloat(numStr);
    return isNaN(amount) ? null : amount;
  }
}

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
    // Israeli bank Excel exports often have title/summary rows above the
    // actual data table.  Use the same header-row scan that detectColumns
    // relies on so parseExcel honours the discovered `range` offset.
    const { data } = this.readExcelSheet(workbook);

    const transactions = data
      .map((row: any) => this.mapRow(row, mapping, sourceType))
      .filter((t): t is ParsedTransaction => t !== null);

    return { transactions, columnMapping: mapping };
  }

  // Scan the first sheet of an Excel workbook trying successive rows as the
  // header row (rows 0–9).  Israeli bank exports commonly have a title row
  // like "תנועות בחשבון" above the real column headers.  Returns the parsed
  // rows keyed by the detected headers, plus the column mapping.
  //
  // For credit-card files, also extracts the billing total from the header
  // area (e.g. "גולד - מסטרקארד - 5560 | ₪ 4,088.58") which is the amount
  // the bank actually debits — distinct from the sum of all transactions
  // which can include installments from prior billing cycles.
  static readExcelSheet(workbook: XLSX.WorkBook): {
    data: any[];
    mapping: ColumnMapping | null;
    billingTotal: number | null;
    cardLabel: string | null;
  } {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    // Try up to 10 header-row offsets (covers title rows, blank rows, etc.)
    for (let skip = 0; skip <= Math.min(9, range.e.r); skip++) {
      const data = XLSX.utils.sheet_to_json(sheet, { range: skip });
      if (!data || data.length === 0) continue;

      const mapping = this.detectColumns(data as any[]);
      if (mapping) {
        // Scan pre-header rows for CC metadata (billing total + card label).
        const ccMeta = this.extractCreditCardMeta(sheet, skip);
        return {
          data: data as any[],
          mapping,
          billingTotal: ccMeta.billingTotal,
          cardLabel: ccMeta.cardLabel,
        };
      }
    }

    // Fallback: return the default (row 0 as header) so callers can still
    // inspect what was found — even though detection failed.
    return {
      data: XLSX.utils.sheet_to_json(sheet) as any[],
      mapping: null,
      billingTotal: null,
      cardLabel: null,
    };
  }

  // Scan pre-header rows of the spreadsheet for credit-card metadata:
  //   • billingTotal — the monthly charge the bank debits (e.g. ₪4,088.58)
  //   • cardLabel    — human-readable card identifier, e.g.
  //                    "כרטיס 5560 ע״ש נירית ברג"
  //
  // Israeli CC exports (Isracard, Cal, Max) have a consistent header layout:
  //   Row ~4: "גולד - מסטרקארד - 5560 | ₪ 4,088.58"   (card name + total)
  //   Row ~5: "על שם נירית ברג | לחיוב ב-10.06"         (cardholder name)
  private static extractCreditCardMeta(
    sheet: XLSX.WorkSheet,
    headerRow: number
  ): { billingTotal: number | null; cardLabel: string | null } {
    if (headerRow <= 0) return { billingTotal: null, cardLabel: null };

    // Read the pre-header rows as raw arrays (no header interpretation).
    const preRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      range: 0,
      header: 1, // raw column-index arrays
    });

    const amountRe = /₪\s*([\d,]+(?:\.\d+)?)/;
    // Last 4 digits of the card number — appears after a dash at the end
    // of the card name cell, e.g. "גולד - מסטרקארד - 5560".
    // The dash prefix prevents matching years like "2026" from title rows.
    const last4Re = /[-–]\s*(\d{4})\s*$/;
    // Cardholder line: "על שם NAME" (possibly followed by other info).
    const holderRe = /על\s+שם\s+(.+)/;

    let billingTotal: number | null = null;
    let last4: string | null = null;
    let holderName: string | null = null;

    for (let r = 0; r < Math.min(headerRow, preRows.length); r++) {
      const row = preRows[r];
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        if (cell == null) continue;
        const str = String(cell).trim();

        // Billing total (₪ amount)
        if (!billingTotal) {
          const am = str.match(amountRe);
          if (am) {
            const total = parseFloat(am[1].replace(/,/g, ''));
            if (!isNaN(total) && total > 0) billingTotal = total;
          }
        }

        // Last 4 digits of card number (from the card-name cell,
        // same row that has the billing total or the row before it).
        if (!last4) {
          const dm = str.match(last4Re);
          if (dm) last4 = dm[1];
        }

        // Cardholder name ("על שם …")
        if (!holderName) {
          const hm = str.match(holderRe);
          if (hm) holderName = hm[1].trim();
        }
      }
    }

    // Build the card label: "כרטיס 5560 ע״ש נירית ברג"
    let cardLabel: string | null = null;
    if (last4 && holderName) {
      cardLabel = `כרטיס ${last4} ע״ש ${holderName}`;
    } else if (last4) {
      cardLabel = `כרטיס ${last4}`;
    }

    return { billingTotal, cardLabel };
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
  // and encoding (UTF-8 or Windows-1255, common in Israeli bank exports).
  static readRawRows(buffer: Buffer): Promise<any[]> {
    const normalized = this.normalizeEncoding(buffer);
    const separator = this.detectDelimiter(normalized);
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
      Readable.from([normalized])
        .pipe(csvParser(options))
        .on('data', (row: any) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  // Israeli bank exports are often Windows-1255 encoded. Detect and convert
  // to UTF-8 so Hebrew column headers and values match our regex patterns.
  private static normalizeEncoding(buffer: Buffer): Buffer {
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return buffer.subarray(3);
    }

    const sample = buffer.subarray(0, Math.min(500, buffer.length));
    let hasHighBytes = false;
    let validUtf8 = true;

    for (let i = 0; i < sample.length; i++) {
      const b = sample[i];
      if (b <= 0x7F) continue;
      hasHighBytes = true;
      if (b >= 0xC0 && b <= 0xDF) {
        if (i + 1 >= sample.length || (sample[i + 1] & 0xC0) !== 0x80) {
          validUtf8 = false;
          break;
        }
        i++;
      } else if (b >= 0xE0 && b <= 0xEF) {
        if (
          i + 2 >= sample.length ||
          (sample[i + 1] & 0xC0) !== 0x80 ||
          (sample[i + 2] & 0xC0) !== 0x80
        ) {
          validUtf8 = false;
          break;
        }
        i += 2;
      } else if (b >= 0x80 && b < 0xC0) {
        validUtf8 = false;
        break;
      }
    }

    if (hasHighBytes && !validUtf8) {
      try {
        const decoded = new TextDecoder('windows-1255').decode(buffer);
        return Buffer.from(decoded, 'utf8');
      } catch {
        return buffer;
      }
    }

    return buffer;
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
    let amount = this.extractAmount(row, mapping);

    if (!date || amount === null) return null;

    // Credit-card statements list charges as positive numbers, but they
    // are expenses.  When using a single amount column (no debit/credit
    // split) we negate the sign so charges become negative and refunds
    // (negative in the file) become positive.
    if (
      sourceType === 'credit_card' &&
      mapping.amountColumn &&
      !mapping.debitColumn &&
      !mapping.creditColumn
    ) {
      amount = -amount;
    }

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
    const used = new Set<string>();
    const find = (re: RegExp) => {
      const h = headers.find((h) => !used.has(h) && re.test(h));
      if (h) used.add(h);
      return h;
    };

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

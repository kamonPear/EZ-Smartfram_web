// ตัวสร้างไฟล์สำรองข้อมูลฝั่งเบราว์เซอร์ (ไม่พึ่งไลบรารีเพิ่ม): SQL, Excel (.xlsx) และ ZIP รวมสองแบบ
// ข้อมูลเข้าเป็น "ตาราง" = ชื่อ + แถว (object) ต่อหมวดข้อมูล

export type ExportRow = Record<string, unknown>;

export interface ExportTable {
  name: string; // ชื่อตาราง/ชีต (ภาษาอังกฤษสำหรับ SQL ได้จาก key, ภาษาไทยสำหรับชีต Excel)
  sheetName: string;
  rows: ExportRow[];
}

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// ZIP (เก็บแบบไม่บีบอัด STORE - เล็กและเรียบง่าย Excel/ซอฟต์แวร์ ZIP ทั่วไปเปิดได้)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function createZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() / 2) & 31);
  const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // ชื่อไฟล์เป็น UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    chunks.push(local, entry.data);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);

    offset += local.length + size;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Excel (.xlsx) - หนึ่งชีตต่อหนึ่งตาราง แถวแรกเป็นหัวคอลัมน์ตัวหนา
// ---------------------------------------------------------------------------
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // ตัดอักขระควบคุมที่ XML ไม่รองรับ (ยกเว้นแท็บ/ขึ้นบรรทัดใหม่)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ชื่อชีต Excel: ไม่เกิน 31 ตัวอักษร ห้ามมี [ ] : * ? / \ และต้องไม่ซ้ำกัน
function safeSheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    let base = raw.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
    let candidate = base;
    let i = 2;
    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${i++})`;
      candidate = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

function sheetXml(rows: ExportRow[]): string {
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

  if (columns.length === 0) {
    return head + '<sheetData><row r="1"><c r="A1" t="inlineStr" s="1"><is><t>ไม่มีข้อมูล</t></is></c></row></sheetData></worksheet>';
  }

  const widths = columns.map((c) => {
    const longest = Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length));
    return Math.min(50, Math.max(10, longest + 2));
  });
  const cols = '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';

  const headerRow =
    '<row r="1">' +
    columns.map((c, i) => `<c r="${columnName(i)}1" t="inlineStr" s="1"><is><t>${xmlEscape(c)}</t></is></c>`).join('') +
    '</row>';

  const body = rows
    .map((row, ri) => {
      const r = ri + 2;
      const cells = columns
        .map((c, ci) => {
          const v = row[c];
          const ref = `${columnName(ci)}${r}`;
          if (v === null || v === undefined || v === '') return '';
          if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
          if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(v))}</t></is></c>`;
        })
        .join('');
      return `<row r="${r}">${cells}</row>`;
    })
    .join('');

  return head + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` + cols + `<sheetData>${headerRow}${body}</sheetData></worksheet>`;
}

export function buildXlsx(tables: ExportTable[], now: Date = new Date()): Uint8Array {
  const sheets = tables.length > 0 ? tables : [{ name: 'empty', sheetName: 'ไม่มีข้อมูล', rows: [] }];
  const names = safeSheetNames(sheets.map((t) => t.sheetName));

  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
          '</Types>'
      ),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
          '</sheets></workbook>'
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
          `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
      ),
    },
    {
      name: 'xl/styles.xml',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
          '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
          '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
      ),
    },
    ...sheets.map((t, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: encoder.encode(sheetXml(t.rows)) })),
  ];
  return createZip(files, now);
}

// ---------------------------------------------------------------------------
// SQL - สร้างตาราง backup_<ชื่อ> (CREATE TABLE IF NOT EXISTS) แล้ว INSERT ข้อมูลทั้งหมด
// โหลดเข้า MySQL ได้ทันที (ตารางสำรองแยกจากตารางจริงของระบบ - ไม่เขียนทับข้อมูลปัจจุบัน)
// ---------------------------------------------------------------------------
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function sqlIdent(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_฀-๿]/g, '_');
  return '`' + (cleaned || 'col') + '`';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// 'YYYY-MM-DDTHH:mm:ss...' -> 'YYYY-MM-DD HH:mm:ss' เวลาท้องถิ่นของเครื่อง (รูปแบบที่ MySQL รับได้ทุกเวอร์ชัน)
function toSqlDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function sqlString(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\0/g, '') + "'";
}

function sqlType(values: unknown[]): string {
  const present = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (present.length === 0) return 'VARCHAR(255)';
  if (present.every((v) => typeof v === 'boolean')) return 'TINYINT(1)';
  if (present.every((v) => typeof v === 'number' && isFinite(v))) {
    return present.every((v) => Number.isInteger(v as number)) ? 'BIGINT' : 'DOUBLE';
  }
  if (present.every((v) => typeof v === 'string' && ISO_DATETIME.test(v as string))) return 'DATETIME';
  const longest = Math.max(...present.map((v) => String(v).length));
  return longest > 255 ? 'LONGTEXT' : 'VARCHAR(255)';
}

function sqlValue(v: unknown, type: string): string {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
  const s = String(v);
  if (type === 'DATETIME') return sqlString(toSqlDateTime(s));
  return sqlString(s);
}

export function buildSql(tables: ExportTable[], meta: { exportedAt: Date; exportedBy?: string | null }): string {
  const lines: string[] = [
    '-- EZ-SmartFarm backup',
    `-- สำรองเมื่อ: ${meta.exportedAt.toISOString()}`,
    ...(meta.exportedBy ? [`-- ผู้ใช้: ${meta.exportedBy}`] : []),
    '-- สคริปต์นี้สร้างตาราง backup_* (ถ้ายังไม่มี) แล้วเพิ่มข้อมูลที่สำรองไว้ โหลดเข้า MySQL ได้ด้วยคำสั่ง',
    '--   mysql -u <user> -p <database> < ไฟล์นี้.sql',
    '-- ตารางสำรองแยกจากตารางจริงของระบบ ไม่เขียนทับข้อมูลปัจจุบัน - ต้องการนำกลับเข้าตารางจริงให้คัดลอกด้วย INSERT ... SELECT',
    '',
    'SET NAMES utf8mb4;',
    '',
  ];

  for (const table of tables) {
    const tableName = sqlIdent('backup_' + table.name);
    const columns = Array.from(new Set(table.rows.flatMap((r) => Object.keys(r))));
    lines.push(`-- ${table.sheetName} (${table.rows.length} รายการ)`);
    if (columns.length === 0) {
      lines.push('-- (ไม่มีข้อมูล)', '');
      continue;
    }
    const types = columns.map((c) => sqlType(table.rows.map((r) => r[c])));
    lines.push(
      `CREATE TABLE IF NOT EXISTS ${tableName} (`,
      columns.map((c, i) => `  ${sqlIdent(c)} ${types[i]} NULL`).join(',\n'),
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
    );
    const colList = columns.map(sqlIdent).join(', ');
    for (let i = 0; i < table.rows.length; i += 100) {
      const batch = table.rows.slice(i, i + 100);
      lines.push(
        `INSERT INTO ${tableName} (${colList}) VALUES`,
        batch.map((r) => '  (' + columns.map((c, ci) => sqlValue(r[c], types[ci])).join(', ') + ')').join(',\n') + ';'
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

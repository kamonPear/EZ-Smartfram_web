import { ExportTable } from './backup-export.util';

// ตัวสร้างไฟล์ PDF ฝั่งเบราว์เซอร์ (ไม่พึ่งไลบรารี): วาดรายงานลงแคนวาสด้วยฟอนต์ Kanit (เบราว์เซอร์จัดวรรณยุกต์/
// สระภาษาไทยให้ถูกต้องเอง) แล้วฝังแต่ละหน้าเป็นภาพ JPEG ในไฟล์ PDF ขนาด A4
// ข้อจำกัด: ข้อความใน PDF เป็นภาพ - เลือก/คัดลอก/ค้นหาข้อความในไฟล์ไม่ได้ (ถ้าต้องการข้อมูลที่ใช้ต่อ ให้ใช้ Excel/SQL)

const PAGE_W = 1240; // A4 ที่ 150 dpi
const PAGE_H = 1754;
const MARGIN = 70;
const ROW_H = 38;
const FONT = "'Kanit', 'Leelawadee UI', 'Tahoma', sans-serif";

const COLUMN_LABELS: Record<string, string> = {
  coop_id: 'รหัสคอก',
  name_coop: 'ชื่อคอก',
  amount: 'จำนวนไก่',
  birthday: 'วันเกิดไก่',
  date_adopt_animals: 'วันรับเข้าเลี้ยง',
  note: 'หมายเหตุ',
  pos_x: 'ตำแหน่ง X (%)',
  pos_y: 'ตำแหน่ง Y (%)',
  slot_index: 'หมายเลข',
  name: 'ชื่อ',
  device_type: 'ชนิด',
  date_collect_egg: 'วันที่เก็บ',
  number_egg: 'จำนวนไข่ (ฟอง)',
  record_date: 'วันที่บันทึก',
  healthy: 'ไก่สุขภาพดี',
  poor_health: 'ไก่ป่วย',
  method: 'วิธีให้',
  min_age_days: 'อายุต่ำสุด (วัน)',
  max_age_days: 'อายุสูงสุด (วัน)',
  description: 'คำอธิบาย',
  appointment_date: 'วันนัดตรวจ',
  temperature: 'อุณหภูมิ (°C)',
  ammonia: 'แอมโมเนีย (PPM)',
};

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  const s = String(value);
  if (ISO_DATETIME.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return s.replace(/\s+/g, ' ');
}

interface Pen {
  canvases: HTMLCanvasElement[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  y: number;
}

function newPage(pen: Pen) {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = 'middle';
  pen.canvases.push(canvas);
  pen.canvas = canvas;
  pen.ctx = ctx;
  pen.y = MARGIN;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function drawTable(pen: Pen, table: ExportTable) {
  const columns = Array.from(new Set(table.rows.flatMap((r) => Object.keys(r))));
  const usable = PAGE_W - MARGIN * 2;

  // หัวข้อหมวด (ต้องมีที่พอสำหรับหัวข้อ + หัวตาราง + อย่างน้อย 2 แถว ไม่งั้นขึ้นหน้าใหม่)
  if (pen.y + 60 + ROW_H * 3 > PAGE_H - MARGIN) newPage(pen);
  const { ctx } = pen;
  ctx.fillStyle = '#2e9e4f';
  ctx.fillRect(MARGIN, pen.y, 8, 36);
  ctx.fillStyle = '#111111';
  ctx.font = `600 30px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(table.name === 'summary' ? table.sheetName : `${table.sheetName}  (${table.rows.length} รายการ)`, MARGIN + 22, pen.y + 19);
  pen.y += 56;

  if (columns.length === 0) {
    ctx.fillStyle = '#777777';
    ctx.font = `400 22px ${FONT}`;
    ctx.fillText('ไม่มีข้อมูล', MARGIN + 6, pen.y + 14);
    pen.y += 60;
    return;
  }

  // ความกว้างคอลัมน์ตามเนื้อหา (วัดจากข้อความจริง) แล้วย่อสัดส่วนให้พอดีหน้ากระดาษ
  ctx.font = `600 20px ${FONT}`;
  const headers = columns.map((c) => COLUMN_LABELS[c] ?? c);
  const sample = table.rows.slice(0, 200);
  ctx.font = `400 20px ${FONT}`;
  const natural = columns.map((c, i) => {
    const longestBody = Math.max(0, ...sample.map((r) => ctx.measureText(formatCell(r[c])).width));
    ctx.font = `600 20px ${FONT}`;
    const head = ctx.measureText(headers[i]).width;
    ctx.font = `400 20px ${FONT}`;
    return Math.min(380, Math.max(longestBody, head) + 24);
  });
  const total = natural.reduce((s, w) => s + w, 0);
  const scale = total > usable ? usable / total : 1;
  const widths = natural.map((w) => w * scale);
  // ถ้ากว้างไม่เต็มหน้า กระจายส่วนที่เหลือให้ทุกคอลัมน์เท่าๆ กัน
  const extra = total < usable ? (usable - total) / columns.length : 0;
  const finalWidths = widths.map((w) => w + extra);

  const drawHeader = () => {
    const c = pen.ctx;
    c.fillStyle = '#e8f5e9';
    c.fillRect(MARGIN, pen.y, usable, ROW_H);
    c.fillStyle = '#1b5e20';
    c.font = `600 20px ${FONT}`;
    c.textAlign = 'left';
    let x = MARGIN;
    headers.forEach((h, i) => {
      c.fillText(fit(c, h, finalWidths[i] - 16), x + 10, pen.y + ROW_H / 2 + 1);
      x += finalWidths[i];
    });
    pen.y += ROW_H;
  };
  drawHeader();

  table.rows.forEach((row, ri) => {
    if (pen.y + ROW_H > PAGE_H - MARGIN - 30) {
      newPage(pen);
      drawHeader();
    }
    const c = pen.ctx;
    if (ri % 2 === 1) {
      c.fillStyle = '#f6f6f6';
      c.fillRect(MARGIN, pen.y, usable, ROW_H);
    }
    c.fillStyle = '#222222';
    c.font = `400 20px ${FONT}`;
    c.textAlign = 'left';
    let x = MARGIN;
    columns.forEach((col, i) => {
      c.fillText(fit(c, formatCell(row[col]), finalWidths[i] - 16), x + 10, pen.y + ROW_H / 2 + 1);
      x += finalWidths[i];
    });
    c.fillStyle = '#e0e0e0';
    c.fillRect(MARGIN, pen.y + ROW_H - 1, usable, 1);
    pen.y += ROW_H;
  });
  pen.y += 40;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('สร้างภาพหน้า PDF ไม่สำเร็จ'));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      },
      'image/jpeg',
      0.88
    );
  });
}

export interface PdfMeta {
  title: string;
  exportedAt: Date;
  exportedBy?: string | null;
}

export async function buildPdf(tables: ExportTable[], meta: PdfMeta): Promise<Uint8Array> {
  // รอฟอนต์ Kanit โหลดก่อนวาด (ถ้าโหลดไม่ได้ ใช้ฟอนต์สำรองของเครื่อง)
  try {
    await Promise.all([document.fonts.load(`400 20px 'Kanit'`), document.fonts.load(`600 30px 'Kanit'`)]);
  } catch {
    // ใช้ฟอนต์สำรอง
  }

  const pen = { canvases: [] as HTMLCanvasElement[] } as Pen;
  newPage(pen);

  // ส่วนหัวรายงาน
  const ctx = pen.ctx;
  ctx.fillStyle = '#1b5e20';
  ctx.font = `600 44px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(meta.title, MARGIN, pen.y + 24);
  pen.y += 62;
  ctx.fillStyle = '#555555';
  ctx.font = `400 22px ${FONT}`;
  const when = meta.exportedAt.toLocaleString('th-TH', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  ctx.fillText(`สำรองเมื่อ ${when}${meta.exportedBy ? `  ·  ผู้ใช้ ${meta.exportedBy}` : ''}`, MARGIN, pen.y + 12);
  pen.y += 50;

  // สรุปจำนวนต่อหมวด
  drawTable(pen, {
    name: 'summary',
    sheetName: 'สรุปข้อมูลที่สำรอง',
    rows: tables.map((t) => ({ 'หมวดข้อมูล': t.sheetName, 'จำนวนรายการ': t.rows.length })),
  });

  for (const t of tables) drawTable(pen, t);

  // ท้ายหน้า: ชื่อระบบ + เลขหน้า
  pen.canvases.forEach((canvas, i) => {
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#888888';
    c.font = `400 18px ${FONT}`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText('EZ-SmartFarm · รายงานสำรองข้อมูล', MARGIN, PAGE_H - 36);
    c.textAlign = 'right';
    c.fillText(`หน้า ${i + 1} / ${pen.canvases.length}`, PAGE_W - MARGIN, PAGE_H - 36);
  });

  const pages: PdfPage[] = [];
  for (const canvas of pen.canvases) pages.push({ jpeg: await toJpeg(canvas), width: PAGE_W, height: PAGE_H });
  return assemblePdf(pages, meta);
}

// ---------------------------------------------------------------------------
// ประกอบไฟล์ PDF จากภาพ JPEG ทีละหน้า (แยกออกมาให้ทดสอบได้โดยไม่ต้องใช้ DOM)
// ---------------------------------------------------------------------------
export interface PdfPage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

const textEncoder = new TextEncoder();

function pdfTextString(s: string): string {
  // ข้อความ Unicode ใน PDF: UTF-16BE มี BOM เขียนเป็น hex string
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex}>`;
}

export function assemblePdf(pages: PdfPage[], meta: { title: string; exportedAt: Date }): Uint8Array {
  const A4_W = 595.28;
  const A4_H = 841.89;
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? textEncoder.encode(data) : data;
    parts.push(bytes);
    length += bytes.length;
  };
  const beginObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  push('%PDF-1.4\n%âãÏÓ\n');

  // object: 1 = Catalog, 2 = Pages, 3 = Info, แล้วหน้าละ 3 ตัว (Page, Content, Image)
  const firstPageObj = 4;
  const pageObjIds = pages.map((_, i) => firstPageObj + i * 3);

  beginObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  beginObject(2);
  push(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`);
  const d = meta.exportedAt;
  const pad = (n: number) => String(n).padStart(2, '0');
  beginObject(3);
  push(
    `<< /Title ${pdfTextString(meta.title)} /Producer ${pdfTextString('EZ-SmartFarm')} /CreationDate (D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z) >>\nendobj\n`
  );

  pages.forEach((page, i) => {
    const pageId = firstPageObj + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const content = `q ${A4_W} 0 0 ${A4_H} 0 0 cm /Im0 Do Q`;

    beginObject(pageId);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    beginObject(contentId);
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    beginObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`
    );
    push(page.jpeg);
    push('\nendstream\nendobj\n');
  });

  const objectCount = firstPageObj + pages.length * 3; // จำนวน object + 1 (object 0)
  const xrefOffset = length;
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let id = 1; id < objectCount; id++) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

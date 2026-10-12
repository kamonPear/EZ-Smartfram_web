// ตัวช่วยค้นหาแบบง่าย ใช้ร่วมกันทุกหน้า: ตัดช่องว่างหัวท้าย ไม่สนตัวพิมพ์เล็ก-ใหญ่ และ
// ค้นหลายคำได้ (คั่นด้วยช่องว่าง) - ทุกคำต้องเจออย่างน้อยหนึ่งฟิลด์ถึงถือว่าตรง

export function normalizeQuery(query: string | null | undefined): string {
  return (query ?? '').trim().toLowerCase();
}

// คืน true ถ้าไม่ได้พิมพ์อะไร (แสดงทั้งหมด) หรือทุกคำของ query ปรากฏในฟิลด์ใดฟิลด์หนึ่ง
export function matchesQuery(query: string | null | undefined, ...fields: Array<string | number | null | undefined>): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const haystack = fields
    .filter((f) => f !== null && f !== undefined)
    .map((f) => String(f).toLowerCase())
    .join(' ');
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

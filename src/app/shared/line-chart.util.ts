// ตัวช่วยวาดกราฟเส้นแบบ SVG (ใช้ในกราฟไข่ของหน้าข้อมูลคอกและหน้าบันทึกไข่)
//
// SVG ใช้ viewBox 0-100 ทั้งแกน x/y และยืดเต็มกล่อง (preserveAspectRatio="none") ส่วนจุดของ
// แต่ละช่วงวาดเป็น HTML วางทับตามเปอร์เซ็นต์เดียวกัน จุดจึงกลมเสมอไม่ถูกยืดตามขนาดกล่อง

// ความสูงของจุด (% จากล่าง) - เว้นขอบล่าง 8% ให้จุดที่ค่าเป็น 0 ยังมองเห็น และเว้นขอบบน
// ให้จุดสูงสุดไม่ชนขอบกล่อง
export function linePointPercent(value: number, max: number): number {
  return 8 + (Math.max(0, value) / Math.max(1, max)) * 78;
}

// เส้นโค้งผ่านทุกจุด (Catmull-Rom แปลงเป็น Bezier) และพื้นที่ใต้เส้นไว้เติมสีไล่ระดับ
// x ของแต่ละจุด = กึ่งกลางช่องของช่วงนั้น (ช่องกว้างเท่ากัน) ให้ตรงกับจุด HTML ที่วางทับ
// max: ส่งมาเมื่อมีหลายเส้นในกราฟเดียวกันให้ใช้สเกลเดียวกัน (ไม่ส่ง = ค่าสูงสุดของเส้นนี้)
export function smoothLinePaths(values: number[], max = Math.max(1, ...values)): { line: string; area: string } {
  if (values.length === 0) return { line: '', area: '' };
  const pts = values.map((v, i): [number, number] => [((i + 0.5) / values.length) * 100, 100 - linePointPercent(v, max)]);
  // จำกัดจุดควบคุมไม่ให้เส้นโค้งเลยขอบล่าง/บน (เช่น จุด 0 ติดกับจุดสูง ๆ)
  const clampY = (y: number) => Math.min(100, Math.max(0, y));

  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  const area = `${line} L ${pts[pts.length - 1][0]} 100 L ${pts[0][0]} 100 Z`;
  return { line, area };
}

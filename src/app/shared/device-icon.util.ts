// ไอคอนอุปกรณ์ - ของเดิมใช้รูปถ่ายสินค้าขนาดเล็ก (PNG ~50px) ที่ดูเบลอ/ไม่ชัดตอน
// ถูกขยายเป็นวงกลมไอคอน แถมไฟล์ esp32.png ดันเป็นรูปการ์ดจอ ไม่ใช่บอร์ด ESP32 จริง
// (ของผิด) และไอคอนหลอดไฟเดิมก็ render ไม่ขึ้นเลย (bug: ".../%23F5A623" ถูก
// encodeURIComponent ครอบซ้ำอีกชั้น ทำให้ "#" ที่ escape ไว้ล่วงหน้ากลายเป็น "%2523"
// แทนที่จะเป็น "%23" เบราว์เซอร์เลยอ่านค่าสีไม่ออก) เปลี่ยนมาวาดเป็นไอคอนเส้น SVG
// เองทั้งหมดแทน คมชัดทุกขนาดจอ สไตล์เดียวกับไอคอนอื่นๆ ในแอป (outline, currentColor)
// และคืนเป็น data: URI ใช้แทนที่ <img src> ตรงๆ ได้ทุกจุดที่มีอยู่ ไม่ต้องเปลี่ยนโครง template

const ICON_COLOR = '#2E9E4F';

function svgIcon(innerPaths: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${innerPaths}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ชิป/ไมโครคอนโทรลเลอร์ (ESP 32)
const ESP32_SVG = svgIcon(
  '<rect x="6" y="6" width="12" height="12" rx="1.5"/>' +
  '<rect x="9.5" y="9.5" width="5" height="5"/>' +
  '<path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'
);

// เซนเซอร์วัดคุณภาพอากาศ/แก๊ส (MQ-135) - ไอคอนสายลม สื่อถึงการตรวจจับอากาศ
const GAS_SVG = svgIcon(
  '<path d="M3 8h11a3 3 0 1 0-3-3"/>' +
  '<path d="M3 12h15a3 3 0 1 1-3 3"/>' +
  '<path d="M3 16h8"/>'
);

// เซนเซอร์ตรวจจับความเคลื่อนไหว (PIR MOTION) - คลื่นสัญญาณจากจุดกึ่งกลาง
const MOTION_SVG = svgIcon(
  '<circle cx="12" cy="18" r="1.3" fill="' + ICON_COLOR + '" stroke="none"/>' +
  '<path d="M8.5 14.5a5 5 0 0 1 7 0"/>' +
  '<path d="M5.5 11.5a9 9 0 0 1 13 0"/>'
);

// เซนเซอร์วัดอุณหภูมิ/ความชื้น (DHT22) - เทอร์โมมิเตอร์
const THERMOMETER_SVG = svgIcon(
  '<path d="M10 13.4V4.5a2 2 0 1 1 4 0v8.9a4 4 0 1 1-4 0Z"/>' +
  '<line x1="12" y1="7" x2="12" y2="13.5"/>'
);

// เซนเซอร์แม่เหล็กประตู/หน้าต่าง (MC-38) - สองก้อนคั่นด้วยเส้นประ
const DOOR_SENSOR_SVG = svgIcon(
  '<rect x="2" y="9" width="7" height="6" rx="1.2"/>' +
  '<rect x="15" y="9" width="7" height="6" rx="1.2"/>' +
  '<path d="M9 12h6" stroke-dasharray="2.2 2.2"/>'
);

// พัดลม - ใบพัด 4 แฉกรอบจุดกึ่งกลาง
const FAN_SVG = svgIcon(
  '<circle cx="12" cy="12" r="1.4" fill="' + ICON_COLOR + '" stroke="none"/>' +
  '<path d="M12 12c0-3.2-2.2-5.2-5.2-5.2.1 3.2 2 5.2 5.2 5.2Z"/>' +
  '<path d="M12 12c3.2 0 5.2-2.2 5.2-5.2-3.2.1-5.2 2-5.2 5.2Z"/>' +
  '<path d="M12 12c0 3.2 2.2 5.2 5.2 5.2-.1-3.2-2-5.2-5.2-5.2Z"/>' +
  '<path d="M12 12c-3.2 0-5.2 2.2-5.2 5.2 3.2-.1 5.2-2 5.2-5.2Z"/>'
);

// หลอดไฟ
const BULB_SVG = svgIcon(
  '<path d="M9 18h6"/>' +
  '<path d="M10 22h4"/>' +
  '<path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/>'
);

// กล้องวงจรปิด
const CAMERA_SVG = svgIcon(
  '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/>' +
  '<circle cx="12" cy="13" r="3.3"/>'
);

// ปั๊มน้ำ
const PUMP_SVG = svgIcon(
  '<path d="M12 2s-6.5 7-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 9 12 2 12 2Z"/>'
);

// เซนเซอร์วัดระดับน้ำ
const WATER_LEVEL_SVG = svgIcon(
  '<rect x="5" y="3" width="14" height="18" rx="2"/>' +
  '<path d="M5 13.5c2-1.5 4-1.5 6 0s4 1.5 6 0"/>' +
  '<path d="M5 17.5c2-1.5 4-1.5 6 0s4 1.5 6 0"/>'
);

// สวิตช์ควบคุม/รีเลย์
const RELAY_SVG = svgIcon(
  '<rect x="2" y="7" width="20" height="10" rx="5"/>' +
  '<circle cx="16" cy="12" r="3.2" fill="' + ICON_COLOR + '" stroke="none"/>'
);

// เซนเซอร์แสง
const LIGHT_SENSOR_SVG = svgIcon(
  '<circle cx="12" cy="12" r="4"/>' +
  '<path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'
);

// ออด/เสียงเตือน
const BUZZER_SVG = svgIcon(
  '<path d="M3 9v6h4l5 5V4L7 9H3Z"/>' +
  '<path d="M16 9a4 4 0 0 1 0 6"/>' +
  '<path d="M19 6a8 8 0 0 1 0 12"/>'
);

interface DeviceIconEntry {
  label: string;
  src: string;
  /** คีย์เวิร์ดจับคู่ชื่ออุปกรณ์ (ตัวพิมพ์เล็กทั้งหมด) เพื่อเลือกไอคอนให้อัตโนมัติ
   *  ใช้กับอุปกรณ์เก่าที่ยังมี icon เป็น path รูปเดิมอยู่ใน DB ด้วย ไม่ต้อง migrate ข้อมูล */
  matchKeywords: string[];
}

export const DEVICE_ICON_CHOICES: DeviceIconEntry[] = [
  { label: 'ESP 32', src: ESP32_SVG, matchKeywords: ['esp32', 'esp 32', 'esp-32'] },
  { label: 'MQ-135', src: GAS_SVG, matchKeywords: ['mq-135', 'mq135', 'gas', 'แก๊ส', 'อากาศ'] },
  { label: 'PIR MOTION', src: MOTION_SVG, matchKeywords: ['pir', 'motion', 'เคลื่อนไหว'] },
  { label: 'DHT22', src: THERMOMETER_SVG, matchKeywords: ['dht22', 'dht-22', 'ds18b20', 'อุณหภูมิ', 'temp'] },
  { label: 'MC-38', src: DOOR_SENSOR_SVG, matchKeywords: ['mc-38', 'mc38', 'ประตู', 'door'] },
  { label: 'พัดลม', src: FAN_SVG, matchKeywords: ['พัดลม', 'fan'] },
  { label: 'หลอดไฟ', src: BULB_SVG, matchKeywords: ['หลอดไฟ', 'bulb'] },
  { label: 'กล้อง', src: CAMERA_SVG, matchKeywords: ['กล้อง', 'camera', 'cctv'] },
  { label: 'ปั๊มน้ำ', src: PUMP_SVG, matchKeywords: ['ปั๊ม', 'pump'] },
  { label: 'วัดระดับน้ำ', src: WATER_LEVEL_SVG, matchKeywords: ['ระดับน้ำ', 'water level', 'float'] },
  { label: 'สวิตช์/รีเลย์', src: RELAY_SVG, matchKeywords: ['สวิตช์', 'รีเลย์', 'relay', 'switch'] },
  { label: 'เซนเซอร์แสง', src: LIGHT_SENSOR_SVG, matchKeywords: ['เซนเซอร์แสง', 'ldr', 'light sensor'] },
  { label: 'ออด/เสียงเตือน', src: BUZZER_SVG, matchKeywords: ['ออด', 'buzzer', 'alarm', 'เสียงเตือน'] },
];

/** คืน src ของไอคอนอุปกรณ์ที่ใช้แทน <img src> ได้ตรงๆ - จับคู่จากชื่ออุปกรณ์ก่อน
 *  เสมอ (ใช้ได้ทั้งอุปกรณ์เก่าที่ icon ใน DB ยังเป็น path รูปเดิม และอุปกรณ์ที่เพิ่ง
 *  เพิ่มเอง) ถ้าไม่เข้าเงื่อนไขไหนเลย fallback ไปตาม icon ที่ backend ส่งมา
 *  (กรณีผู้ใช้เลือกไอคอนจาก DEVICE_ICON_CHOICES ไว้แล้วตอนเพิ่มชนิดอุปกรณ์) หรือ
 *  ไอคอน ESP 32 เป็นค่าสุดท้าย */
export function deviceIconSrc(device: { name?: string; icon?: string } | null | undefined): string {
  const name = (device?.name || '').toLowerCase();
  if (name) {
    const match = DEVICE_ICON_CHOICES.find((choice) => choice.matchKeywords.some((kw) => name.includes(kw)));
    if (match) return match.src;
  }
  return device?.icon || ESP32_SVG;
}

const EMAIL = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.\p{L}{2,}/gu;
const PHONE = /(?<![\d+])(?:\+?62|0)[\s-]?8(?:[\s-]?\d){7,12}(?!\d)/g;
const LONG_NUMBER = /(?<!\d)\d(?:[\s-]?\d){9,}(?!\d)/g;

export function redact(text: string): string {
  return text.replace(EMAIL, "[EMAIL]").replace(PHONE, "[NOMOR]").replace(LONG_NUMBER, "[ANGKA]");
}

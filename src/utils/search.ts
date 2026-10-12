const arabicDiacritics = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
export function normalizeSearch(value: string): string {
  return value.toLowerCase().trim().replace(arabicDiacritics, "").replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\s+/g, " ");
}

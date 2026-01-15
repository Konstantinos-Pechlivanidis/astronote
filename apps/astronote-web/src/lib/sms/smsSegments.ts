export type SmsEncoding = 'gsm7' | 'ucs2';

// GSM-7 basic + extension tables (best-effort; used for segment estimation).
// Reference: ETSI TS 123 038 (GSM 03.38). Extended chars count as 2 septets.
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const GSM7_EXT = '^{}\\[~]|€';

export function getSmsSegments(text: string): {
  encoding: SmsEncoding;
  // For GSM-7: septetCount; for UCS-2: charCount
  units: number;
  segments: number;
  perSegment: number;
  singleSegment: number;
} {
  const input = text || '';
  let isGsm7 = true;
  let septets = 0;

  for (const ch of input) {
    if (GSM7_BASIC.includes(ch)) {
      septets += 1;
      continue;
    }
    if (GSM7_EXT.includes(ch)) {
      septets += 2; // escape + char
      continue;
    }
    isGsm7 = false;
    break;
  }

  if (!isGsm7) {
    const charCount = input.length;
    const single = 70;
    const multi = 67;
    const segments = charCount === 0 ? 0 : charCount <= single ? 1 : Math.ceil(charCount / multi);
    const perSegment = segments <= 1 ? single : multi;
    return { encoding: 'ucs2', units: charCount, segments, perSegment, singleSegment: single };
  }

  const single = 160;
  const multi = 153;
  const segments = septets === 0 ? 0 : septets <= single ? 1 : Math.ceil(septets / multi);
  const perSegment = segments <= 1 ? single : multi;
  return { encoding: 'gsm7', units: septets, segments, perSegment, singleSegment: single };
}



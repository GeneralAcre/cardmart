import QRCode from "qrcode";

/**
 * A QR code for `text` as one SVG path, one 1×1 square per dark module, in a
 * viewBox of `size` × `size` (a 4-module quiet zone included). Drawn as a path
 * rather than a PNG so it stays sharp at any size, inside ImageResponse too.
 */
export function qrPath(text: string): { d: string; size: number } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const quiet = 4;
  let d = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return { d, size: modules.size + quiet * 2 };
}

/**
 * Crops the middle of a photo to `width`:`height` and re-encodes it as a JPEG
 * no bigger than that (a smaller photo keeps its own size). Runs in the browser.
 */
export async function cropToJpeg(file: File, width: number, height: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = width / height;
  const sw = Math.min(bitmap.width, bitmap.height * ratio);
  const sh = sw / ratio;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(Math.min(width, sw));
  canvas.height = Math.round(canvas.width / ratio);
  canvas
    .getContext("2d")
    ?.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that photo."))), "image/jpeg", 0.88),
  );
}

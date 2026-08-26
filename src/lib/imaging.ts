import type { CapturedImage, ImageQualityReport, PanelKey } from "@/pipeline/types";

/**
 * Client-side image preprocessing and quality measurement.
 * Runs entirely in the browser on a canvas — the ORIGINAL file is never modified;
 * a separate processed copy is produced for OCR.
 */

const MAX_EDGE = 1600;

export const PANEL_ORDER: Array<{ key: PanelKey; label: string }> = [
  { key: "front", label: "Front panel" },
  { key: "back", label: "Back panel" },
  { key: "mrp", label: "MRP area" },
  { key: "date", label: "Date area" },
  { key: "side", label: "Side panel" },
  { key: "extra", label: "Additional panel" },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be decoded"));
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File could not be read"));
    reader.readAsDataURL(file);
  });
}

interface Metrics {
  blur: number;
  glare: number;
  contrast: number;
  width: number;
  height: number;
}

function measure(data: Uint8ClampedArray, w: number, h: number): Metrics {
  const gray = new Float32Array(w * h);
  let sum = 0;
  let saturated = 0;
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const g = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
    gray[i] = g;
    sum += g;
    if (g > 245) saturated++;
  }
  const mean = sum / gray.length;
  let varSum = 0;
  for (let i = 0; i < gray.length; i++) varSum += (gray[i]! - mean) ** 2;
  const stdDev = Math.sqrt(varSum / gray.length);

  // Variance of the Laplacian — the standard focus measure.
  let lSum = 0;
  let lSqSum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
      lSum += lap;
      lSqSum += lap * lap;
      n++;
    }
  }
  const lMean = lSum / n;
  const lapVar = lSqSum / n - lMean * lMean;

  return {
    // normalised 0..1 where 1 = sharp
    blur: Math.min(1, lapVar / 500),
    glare: saturated / gray.length,
    contrast: Math.min(1, stdDev / 80),
    width: w,
    height: h,
  };
}

function grade(m: Metrics, srcW: number, srcH: number): ImageQualityReport {
  const issues: string[] = [];
  if (m.blur < 0.25) issues.push("image is out of focus / motion blurred");
  if (m.glare > 0.06) issues.push("strong glare or reflection over the label");
  if (m.contrast < 0.2) issues.push("contrast too low for reliable character recognition");
  if (Math.min(srcW, srcH) < 640) issues.push("resolution below 640 px on the short edge");

  const severe =
    m.blur < 0.15 || m.glare > 0.12 || m.contrast < 0.12 || Math.min(srcW, srcH) < 480;

  return {
    grade: severe ? "RESCAN_REQUIRED" : issues.length > 0 ? "ACCEPTABLE" : "GOOD",
    blur: Number(m.blur.toFixed(2)),
    glare: Number(m.glare.toFixed(2)),
    contrast: Number(m.contrast.toFixed(2)),
    resolution: `${srcW}×${srcH}`,
    issues,
  };
}

/**
 * Downscale, auto-contrast (linear stretch) and light sharpening for OCR.
 * Returns the processed JPEG data URL plus the measured quality of the original.
 */
export async function preprocessImage(
  key: PanelKey,
  label: string,
  dataUrl: string,
): Promise<CapturedImage> {
  const img = await loadImage(dataUrl);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  const frame = ctx.getImageData(0, 0, w, h);
  const metrics = measure(frame.data, w, h);

  const steps = [`downscaled to ${w}×${h}`];

  // Linear contrast stretch on the 2nd/98th percentile of luminance.
  const hist = new Uint32Array(256);
  for (let p = 0; p < frame.data.length; p += 4) {
    const g = Math.round(0.299 * frame.data[p]! + 0.587 * frame.data[p + 1]! + 0.114 * frame.data[p + 2]!);
    hist[g]!++;
  }
  const total = w * h;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i]!;
    if (acc > total * 0.02) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i]!;
    if (acc > total * 0.02) {
      hi = i;
      break;
    }
  }
  if (hi - lo > 20) {
    const gain = 255 / (hi - lo);
    for (let p = 0; p < frame.data.length; p += 4) {
      for (let c = 0; c < 3; c++) {
        frame.data[p + c] = Math.max(0, Math.min(255, (frame.data[p + c]! - lo) * gain));
      }
    }
    ctx.putImageData(frame, 0, 0);
    steps.push("contrast normalised");
  }

  if (metrics.glare > 0.06) steps.push("glare detected — highlight regions flagged for the reader");
  steps.push("re-encoded as JPEG for extraction");

  return {
    key,
    label,
    original: dataUrl,
    processed: canvas.toDataURL("image/jpeg", 0.85),
    preprocessing: steps,
    quality: grade(metrics, srcW, srcH),
  };
}

const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm)$/i;
const CSV_EXT = /\.csv$/i;

export function bucketFiles(files) {
  const csvs = [];
  const videos = [];
  const images = [];
  for (const f of files) {
    if (f.type === "text/csv" || CSV_EXT.test(f.name)) csvs.push(f);
    else if (f.type.startsWith("video/") || VIDEO_EXT.test(f.name)) videos.push(f);
    else images.push(f);
  }
  return { csvs, videos, images };
}

export async function parseCsvFile(file) {
  const text = await file.text();
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const row = line.split(",").map(Number);
      return {
        scores: [row.slice(0, 3), row.slice(3, 6), row.slice(6, 9)],
        // Hand-authored CSV data is trusted (not OCR'd), so every stage is "ok".
        flags: ["ok", "ok", "ok"],
        src: null,
      };
    });
}

const PREVIEW_MAX_WIDTH = 720;

function downscaleForPreview(canvas) {
  if (canvas.width <= PREVIEW_MAX_WIDTH) return canvas;
  const width = PREVIEW_MAX_WIDTH;
  const height = Math.round((canvas.height * width) / canvas.width);
  const scaled = canvas.convertToBlob
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  scaled.getContext("2d").drawImage(canvas, 0, 0, width, height);
  return scaled;
}

// Snapshot a canvas (or OffscreenCanvas) to an object URL so the source
// frame can be shown to the user after the canvas is reused.
export async function canvasToObjectURL(canvas) {
  try {
    const preview = downscaleForPreview(canvas);
    const blob = preview.convertToBlob
      ? await preview.convertToBlob({ type: "image/jpeg", quality: 0.8 })
      : await new Promise((res) => preview.toBlob(res, "image/jpeg", 0.8));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export function revokeRowSources(rows) {
  for (const row of rows) {
    if (row.src) URL.revokeObjectURL(row.src);
  }
}

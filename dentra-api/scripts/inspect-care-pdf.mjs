// Read-only inspection and optional PNG rendering. Input is a file path or PDF bytes on stdin.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
globalThis.DOMMatrix = DOMMatrix;
globalThis.ImageData = ImageData;
globalThis.Path2D = Path2D;
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const args = process.argv.slice(2);
const chunks = [];
if (!args[0] || args[0] === '-')
  for await (const chunk of process.stdin) chunks.push(chunk);
const bytes = chunks.length ? Buffer.concat(chunks) : await readFile(args[0]);
const renderDirectory = args[1];
if (renderDirectory) await mkdir(renderDirectory, { recursive: true });
const loading = getDocument({
  data: new Uint8Array(bytes),
  useSystemFonts: false,
  isEvalSupported: false,
});
const document = await loading.promise;
const pages = [];
for (let number = 1; number <= document.numPages; number++) {
  const page = await document.getPage(number);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items
    .filter((item) => 'str' in item)
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    }));
  pages.push({
    text: items.map((item) => item.text).join(' '),
    items,
    width: viewport.width,
    height: viewport.height,
  });
  if (renderDirectory) {
    const scaled = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(
      Math.ceil(scaled.width),
      Math.ceil(scaled.height)
    );
    await page.render({
      canvas,
      canvasContext: canvas.getContext('2d'),
      viewport: scaled,
    }).promise;
    await writeFile(
      join(renderDirectory, `page-${number}.png`),
      await canvas.encode('png')
    );
  }
}
console.log(JSON.stringify({ pageCount: document.numPages, pages }));
await loading.destroy();

import * as pdfjsLib from 'pdfjs-dist';

// Use a worker that is bundled or available via a very reliable CDN
// Trying a different CDN and ensuring the version matches exactly what was installed
const PDFJS_VERSION = '5.7.284'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument({ 
    data: arrayBuffer
  });
  
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    
    const items = textContent.items as any[];
    
    // Group by lines (Y coordinate)
    const linesMap: { [y: number]: any[] } = {};
    items.forEach(item => {
      // PDF.js Y is bottom-to-top, let's keep it but group with tolerance
      const y = item.transform[5];
      const closeY = Object.keys(linesMap).find(existingY => Math.abs(Number(existingY) - y) < 4);
      
      if (closeY) {
        linesMap[Number(closeY)].push(item);
      } else {
        linesMap[y] = [item];
      }
    });

    // Sort Y coordinates descending (top to bottom)
    const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
    
    for (const y of sortedY) {
      const lineItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
      
      let lineText = "";
      let currentX = 0;
      
      // We'll use a virtual grid to maintain alignment
      // Page width in PDF units is viewport.width
      // Let's assume a reasonable character width for mono-spacing (approx 5-7 units)
      const charWidth = 5.8; 
      
      for (const item of lineItems) {
        const itemX = item.transform[4];
        const targetCharPos = Math.round(itemX / charWidth);
        
        if (targetCharPos > lineText.length) {
          lineText = lineText.padEnd(targetCharPos, ' ');
        }
        
        lineText += item.str;
      }
      fullText += lineText + "\n";
    }
    fullText += "\n"; 
  }

  return fullText;
}

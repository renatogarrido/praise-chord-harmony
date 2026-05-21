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
    
    const linesMap: { [y: number]: any[] } = {};
    items.forEach(item => {
      const y = item.transform[5];
      const closeY = Object.keys(linesMap).find(existingY => Math.abs(Number(existingY) - y) < 5);
      
      if (closeY) {
        linesMap[Number(closeY)].push(item);
      } else {
        linesMap[y] = [item];
      }
    });

    const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
    
    for (const y of sortedY) {
      const lineItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
      
      let lineText = "";
      // Usando um multiplicador fixo para manter o alinhamento visual do PDF no texto
      const charWidth = 6.2; 
      
      for (const item of lineItems) {
        const itemX = item.transform[4];
        const targetCharPos = Math.max(0, Math.round(itemX / charWidth));
        
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

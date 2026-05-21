import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
// Using the CDN for the worker to avoid complex build configuration for the worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Sort items by vertical position (y) then horizontal (x)
    // pdf.js gives items in the order they appear in the stream, not necessarily visual order
    const items = textContent.items as any[];
    
    // Group by lines (approximately the same Y coordinate)
    const lines: { [y: number]: any[] } = {};
    items.forEach(item => {
      // Use a tolerance for Y coordinate to group items on the same line
      const y = Math.round(item.transform[5]);
      if (!lines[y]) {
        // Try to find a close Y coordinate within 5 units
        const closeY = Object.keys(lines).find(existingY => Math.abs(Number(existingY) - y) < 5);
        if (closeY) {
          lines[Number(closeY)].push(item);
          return;
        }
        lines[y] = [item];
      } else {
        lines[y].push(item);
      }
    });

    // Sort Y coordinates descending (top to bottom)
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
    
    for (const y of sortedY) {
      const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
      
      // Try to maintain relative horizontal spacing
      let lineText = "";
      let lastX = -1;
      
      for (const item of lineItems) {
        const x = item.transform[4];
        if (lastX !== -1) {
          // Add spaces based on horizontal distance
          // Average character width is roughly 6-10 units in PDF space
          const diff = x - (lastX + (item.width || 0));
          if (diff > 5) {
            const spaces = Math.floor(diff / 6);
            lineText += " ".repeat(Math.max(1, spaces));
          }
        }
        lineText += item.str;
        lastX = x + (item.width || 0);
      }
      fullText += lineText + "\n";
    }
    fullText += "\n"; // Page break
  }

  return fullText.trim();
}

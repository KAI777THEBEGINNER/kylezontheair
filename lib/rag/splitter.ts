export interface Chunk {
  content: string;
  heading: string;
}

export function splitByHeadings(text: string, maxChunkSize = 800, overlap = 100): Chunk[] {
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  let currentHeading = "";
  let buffer = "";

  const flush = () => {
    if (buffer.trim().length === 0) return;
    chunks.push({ content: buffer.trim(), heading: currentHeading });
    if (overlap > 0) {
      const words = buffer.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      buffer = overlapWords.join(" ");
    } else {
      buffer = "";
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
      buffer = line + "\n";
    } else {
      buffer += line + "\n";
      if (buffer.length >= maxChunkSize) {
        flush();
      }
    }
  }

  flush();
  return chunks;
}

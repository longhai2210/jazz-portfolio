export function extractHeadings(content: string): Array<{ id: string; text: string; level: 2 | 3 }> {
  const lines = content.split('\n');
  const headings: Array<{ id: string; text: string; level: 2 | 3 }> = [];

  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length as 2 | 3;
      const text = match[2].trim().replace(/[*_~`[\]()]/g, '');
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      headings.push({ id, text, level });
    }
  }

  return headings;
}

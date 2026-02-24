export function parseInvestmentRange(range: string): number {
  // Extracts the lower bound of the investment range
  // e.g., "$50k - $200k" -> 50000
  const match = range.match(/\$(\d+)k/);
  if (match && match[1]) {
    return parseInt(match[1], 10) * 1000;
  }
  return 0;
}

export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  
  const cleanText = text.toLowerCase();
  const cleanQuery = query.toLowerCase();
  
  // Direct match
  if (cleanText.includes(cleanQuery)) return true;
  
  // Simple fuzzy: check if all characters of query exist in text in order
  let textIndex = 0;
  let queryIndex = 0;
  
  while (textIndex < cleanText.length && queryIndex < cleanQuery.length) {
    if (cleanText[textIndex] === cleanQuery[queryIndex]) {
      queryIndex++;
    }
    textIndex++;
  }
  
  return queryIndex === cleanQuery.length;
}

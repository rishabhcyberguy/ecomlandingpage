function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function limit(value: string, max: number) {
  if (value.length <= max) return value;
  const clipped = value.slice(0, max - 1).trimEnd();
  const boundary = clipped.lastIndexOf(" ");
  return `${(boundary > Math.floor(max * 0.72) ? clipped.slice(0, boundary) : clipped).trimEnd()}…`;
}

export function normalizeSeoTitle(value: string) {
  let title = cleanText(value);
  if (title.length < 25) {
    const hasBrand = /\bpolina\b/i.test(title);
    const hasCategory = /\b(nightwear|clothing|fashion)\b/i.test(title);
    title = hasBrand
      ? (hasCategory ? title : `${title} | Nightwear & Clothing`)
      : `${title} — POLINA Nightwear & Clothing`;
  }
  if (title.length < 25) title = `${title} · Contemporary Fashion`;
  return limit(title, 60);
}

export function normalizeSeoDescription(value: string) {
  let description = cleanText(value);
  if (description.length < 50) {
    description = `${description}${description ? " " : ""}Explore POLINA's published collection and official product details.`;
  }
  if (description.length < 50) description = `${description} Contemporary fashion by POLINA.`;
  return limit(description, 160);
}

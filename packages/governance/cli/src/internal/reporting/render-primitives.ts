export function escapeMarkdownCell(value: string): string {
  return value.replaceAll('|', '\\|');
}

export function renderMarkdownTable(input: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}): string[] {
  const lines: string[] = [];
  const headerLine = input.headers
    .map((cell) => escapeMarkdownCell(cell))
    .join(' | ');
  const separator = input.headers.map(() => '---').join(' | ');

  lines.push(`| ${headerLine} |`);
  lines.push(`| ${separator} |`);

  for (const row of input.rows) {
    const cells = input.headers.map((_, index) =>
      escapeMarkdownCell(row[index] ?? ''),
    );
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines;
}

export function renderTextTable(input: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}): string[] {
  const widths = input.headers.map((header, index) =>
    Math.max(
      header.length,
      ...input.rows.map((row) => (row[index] ?? '').length),
    ),
  );

  return [
    input.headers
      .map((cell, index) => padCell(cell, widths[index]!))
      .join('  '),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...input.rows.map((row) =>
      input.headers
        .map((_, index) => padCell(row[index] ?? '', widths[index]!))
        .join('  '),
    ),
  ];
}

export function renderTwoColumnTextTable(input: {
  headers: readonly [string, string];
  rows: readonly (readonly [string, string])[];
}): string[] {
  return renderTextTable(input);
}

export function renderJsonValue(
  value: unknown,
  options: { stable?: boolean } = {},
): string {
  const serialized = options.stable ? sortKeysDeep(value) : value;
  return JSON.stringify(serialized, null, 2);
}

function padCell(value: string, width: number): string {
  return value.padEnd(width, ' ');
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sortedEntries = Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => [key, sortKeysDeep(record[key])] as const);

  return Object.fromEntries(sortedEntries);
}

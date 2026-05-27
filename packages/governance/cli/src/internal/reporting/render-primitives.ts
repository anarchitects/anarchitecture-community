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

export function renderTwoColumnTextTable(input: {
  headers: readonly [string, string];
  rows: readonly (readonly [string, string])[];
}): string[] {
  const leftWidth = Math.max(
    input.headers[0].length,
    ...input.rows.map((row) => row[0].length),
  );
  const rightWidth = Math.max(
    input.headers[1].length,
    ...input.rows.map((row) => row[1].length),
  );

  return [
    `${padCell(input.headers[0], leftWidth)}  ${padCell(input.headers[1], rightWidth)}`,
    `${'-'.repeat(leftWidth)}  ${'-'.repeat(rightWidth)}`,
    ...input.rows.map(
      (row) => `${padCell(row[0], leftWidth)}  ${padCell(row[1], rightWidth)}`,
    ),
  ];
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

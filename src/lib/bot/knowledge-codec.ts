type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type KnowledgeDocument = { [key: string]: JsonValue; entries: Record<string, JsonValue>[] };

export type PackedBotKnowledge = {
  format: 1;
  sourceContentSha256: string;
  metadata: Record<string, JsonValue>;
  columns: string[];
  values: JsonValue[];
  rows: number[][];
};

function copyValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(copyValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyValue(item)]));
  return value;
}

export function packBotKnowledge(document: KnowledgeDocument, sourceContentSha256: string): PackedBotKnowledge {
  const { entries, ...metadata } = document;
  const columns = [...new Set(entries.flatMap(entry => Object.keys(entry)))];
  const values: JsonValue[] = [], indices = new Map<string, number>();
  const rows = entries.map(entry => {
    const row = columns.map(column => {
      if (!Object.hasOwn(entry, column)) return -1;
      const value = entry[column], key = JSON.stringify(value);
      let index = indices.get(key);
      if (index === undefined) {
        index = values.length;
        values.push(copyValue(value)); indices.set(key, index);
      }
      return index;
    });
    while (row.at(-1) === -1) row.pop();
    return row;
  });
  return { format: 1, sourceContentSha256, metadata: copyValue(metadata) as Record<string, JsonValue>, columns, values, rows };
}

export function unpackBotKnowledge(packed: PackedBotKnowledge): KnowledgeDocument {
  if (packed.format !== 1 || new Set(packed.columns).size !== packed.columns.length) throw new Error("Invalid bot knowledge format");
  const entries = packed.rows.map(row => {
    if (row.length > packed.columns.length) throw new Error("Invalid bot knowledge row");
    const fields: [string, JsonValue][] = [];
    row.forEach((reference, index) => {
      if (reference === -1) return;
      if (!Number.isInteger(reference) || reference < 0 || reference >= packed.values.length) throw new Error("Invalid bot knowledge reference");
      fields.push([packed.columns[index], copyValue(packed.values[reference])]);
    });
    return Object.fromEntries(fields);
  });
  return { ...copyValue(packed.metadata) as Record<string, JsonValue>, entries };
}

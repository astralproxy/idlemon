export function parseCsv(text) {
  if (typeof text !== "string") {
    throw new TypeError("CSV input must be text.");
  }

  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
    } else if (character === '"' || character === "\u0000") {
      throw new Error(`Malformed CSV near character ${index + 1}.`);
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new Error("Malformed CSV: an opening quote was not closed.");
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }
  if (rows.length === 0) {
    throw new Error("The sheet is empty.");
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  if (headers.some((header) => header === "")) {
    throw new Error("The sheet contains an empty column name.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("The sheet contains duplicate column names.");
  }

  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`Row ${rowIndex + 2} has ${values.length} cells; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}

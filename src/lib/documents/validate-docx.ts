import { inflateRawSync } from "node:zlib";
/** Inspect ZIP directory sizes before Mammoth inflates an untrusted DOCX. */
export function validateDocxArchive(buffer: Buffer) {
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Invalid DOCX archive.");
  const count = buffer.readUInt16LE(end + 10),
    directory = buffer.readUInt32LE(end + 16);
  if (count === 65535 || directory === 0xffffffff || count > 3000)
    throw new Error("This DOCX archive is too complex.");
  let cursor = directory,
    total = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (
      cursor + 46 > buffer.length ||
      buffer.readUInt32LE(cursor) !== 0x02014b50
    )
      throw new Error("Invalid DOCX directory.");
    const expanded = buffer.readUInt32LE(cursor + 24),
      nameSize = buffer.readUInt16LE(cursor + 28),
      extra = buffer.readUInt16LE(cursor + 30),
      comment = buffer.readUInt16LE(cursor + 32);
    total += expanded;
    if (total > 64 * 1024 * 1024 || expanded > 32 * 1024 * 1024)
      throw new Error(
        "Expanded DOCX content exceeds the safe processing limit.",
      );
    if (cursor + 46 + nameSize + extra + comment > buffer.length)
      throw new Error("Invalid DOCX entry.");
    const local = buffer.readUInt32LE(cursor + 42),
      compressed = buffer.readUInt32LE(cursor + 20),
      method = buffer.readUInt16LE(cursor + 10);
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50)
      throw new Error("Invalid DOCX entry header.");
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + compressed > buffer.length)
      throw new Error("Invalid DOCX compressed data.");
    const bytes = buffer.subarray(start, start + compressed);
    const actual =
      method === 0
        ? bytes
        : method === 8
          ? inflateRawSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })
          : null;
    if (!actual || actual.length !== expanded)
      throw new Error("Invalid DOCX expanded size.");
    names.add(buffer.subarray(cursor + 46, cursor + 46 + nameSize).toString());
    cursor += 46 + nameSize + extra + comment;
  }
  if (!names.has("[Content_Types].xml") || !names.has("word/document.xml"))
    throw new Error("This ZIP file is not a DOCX document.");
}

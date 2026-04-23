// ZIP "store" (sem compressão) + CRC32.
// Usado para exportar projetos e para gerar DOCX (que é um ZIP).

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = makeCrcTable();

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

function strToUtf8Bytes(str) {
  return new TextEncoder().encode(str);
}

export async function blobToUint8(blob) {
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

export async function createZipStore(entries) {
  // entries: [{name, data: Uint8Array, mtime?: Date}]
  const files = [];
  let offset = 0;
  const chunks = [];

  const now = new Date();

  for (const e of entries) {
    const nameBytes = strToUtf8Bytes(e.name);
    const data = e.data;
    const crc = crc32(data);
    const mtime = e.mtime || now;

    // DOS date/time
    const dosTime = ((mtime.getHours() & 0x1F) << 11) | ((mtime.getMinutes() & 0x3F) << 5) | ((Math.floor(mtime.getSeconds()/2)) & 0x1F);
    const dosDate = (((mtime.getFullYear() - 1980) & 0x7F) << 9) | (((mtime.getMonth()+1) & 0x0F) << 5) | (mtime.getDate() & 0x1F);

    // Local file header
    const localHeader = [
      ...u32(0x04034b50),
      ...u16(20),            // version needed
      ...u16(0),             // flags
      ...u16(0),             // compression = store
      ...u16(dosTime),
      ...u16(dosDate),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0)              // extra len
    ];

    chunks.push(new Uint8Array(localHeader));
    chunks.push(nameBytes);
    chunks.push(data);

    files.push({
      nameBytes,
      crc,
      size: data.length,
      compressedSize: data.length,
      offset,
      dosTime,
      dosDate
    });

    offset += localHeader.length + nameBytes.length + data.length;
  }

  // Central directory
  const centralStart = offset;
  for (const f of files) {
    const centralHeader = [
      ...u32(0x02014b50),
      ...u16(20),             // version made by
      ...u16(20),             // version needed
      ...u16(0),              // flags
      ...u16(0),              // compression store
      ...u16(f.dosTime),
      ...u16(f.dosDate),
      ...u32(f.crc),
      ...u32(f.compressedSize),
      ...u32(f.size),
      ...u16(f.nameBytes.length),
      ...u16(0),              // extra len
      ...u16(0),              // comment len
      ...u16(0),              // disk number start
      ...u16(0),              // internal attrs
      ...u32(0),              // external attrs
      ...u32(f.offset)
    ];
    chunks.push(new Uint8Array(centralHeader));
    chunks.push(f.nameBytes);
    offset += centralHeader.length + f.nameBytes.length;
  }
  const centralSize = offset - centralStart;

  // End of central directory
  const end = [
    ...u32(0x06054b50),
    ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize),
    ...u32(centralStart),
    ...u16(0) // comment length
  ];
  chunks.push(new Uint8Array(end));

  return new Blob(chunks, { type: "application/zip" });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name) {
  return (name || "projeto")
    .replace(/[\\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}


export async function unzipStore(zipBlob) {
  // Leitura simples de ZIP "store" (sem compressão). Funciona para os zips gerados por este app.
  const buf = new Uint8Array(await zipBlob.arrayBuffer());
  const files = new Map();
  let i = 0;
  const sigLocal = 0x04034b50;

  const readU16 = (o) => buf[o] | (buf[o+1] << 8);
  const readU32 = (o) => (buf[o] | (buf[o+1] << 8) | (buf[o+2] << 16) | (buf[o+3] << 24)) >>> 0;

  while (i + 30 < buf.length) {
    const sig = readU32(i);
    if (sig !== sigLocal) break;

    const comp = readU16(i + 8);
    if (comp !== 0) throw new Error("ZIP com compressão não suportado (somente store).");

    const crc = readU32(i + 14); // not used
    const compSize = readU32(i + 18);
    const uncompSize = readU32(i + 22);
    const nameLen = readU16(i + 26);
    const extraLen = readU16(i + 28);

    const nameStart = i + 30;
    const name = new TextDecoder().decode(buf.slice(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compSize;

    files.set(name, buf.slice(dataStart, dataEnd));

    i = dataEnd;
  }
  return files;
}

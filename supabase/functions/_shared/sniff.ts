// Magic-byte content sniffer. Returns a canonical MIME or null. Callers must
// still check the result against their own allowlist before trusting it.

function startsWith(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

export function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // GIF: "GIF8" (covers both GIF87a and GIF89a)
  if (startsWith(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return "image/gif";

  // WebP: "RIFF"....."WEBP". RIFF is also used by AVI; the brand at bytes
  // 8..11 is what differentiates. We deliberately match only "WEBP".
  if (
    startsWith(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  // MP4 (and ftyp-family containers): "ftyp" at offset 4. Any brand.
  if (startsWith(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return "video/mp4";

  // WebM / Matroska EBML header: 1A 45 DF A3.
  if (startsWith(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";

  return null;
}

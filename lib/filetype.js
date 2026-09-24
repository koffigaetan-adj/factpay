// Vérifie que le contenu d'un fichier correspond bien au type annoncé par le navigateur, en
// regardant ses premiers octets (sa « signature »). Un fichier renommé (un script déguisé en
// « photo.png », par exemple) est ainsi refusé même si son type déclaré semble correct.
const SIGNATURES = {
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // 'RIFF' (WEBP au-delà, non vérifié ici)
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/heic': null, // conteneur variable : non vérifié
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // '%PDF'
  // Formats Office récents (.docx, .xlsx) : une archive ZIP
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
  // Formats Office historiques (.doc, .xls)
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.oasis.opendocument.text': [[0x50, 0x4B, 0x03, 0x04]],
  'text/plain': null, // pas de signature possible
};

// true si le contenu correspond au type déclaré, ou si ce type n'a pas de signature vérifiable
export async function matchesType(file) {
  const sigs = SIGNATURES[file.type];
  if (sigs === undefined) return true; // type non répertorié ici : laissé aux autres contrôles
  if (sigs === null) return true;
  const head = Buffer.from(await file.slice(0, 8).arrayBuffer());
  return sigs.some((sig) => sig.every((b, i) => head[i] === b));
}

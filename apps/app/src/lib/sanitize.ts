// Strips noise that streaming services append to track titles so the answer
// viewers must guess stays clean. Examples:
//   "Numb (Remastered 2020)"            → "Numb"
//   "Mr. Brightside - Radio Edit"       → "Mr. Brightside"
//   "Starboy (feat. Daft Punk)"         → "Starboy"
//   "Smells Like Teen Spirit [Live]"    → "Smells Like Teen Spirit"
//   "Closer - Bonus Track"              → "Closer"

// Junk keywords that mark a parenthetical/suffix as removable metadata, not part
// of the real title. Matched case-insensitively, as whole words.
const KEYWORDS = [
  'remaster(?:ed)?(?:\\s*\\d{2,4})?',
  'radio\\s*(?:edit|mix|version)',
  'single\\s*version',
  'album\\s*version',
  'extended(?:\\s*(?:mix|version))?',
  'original\\s*(?:mix|version)',
  'club\\s*mix',
  're-?recorded(?:\\s*\\d{2,4})?',
  'remix(?:ed)?',
  'edit',
  'bonus(?:\\s*track)?',
  'live(?:\\s*(?:version|session))?',
  'deluxe(?:\\s*(?:edition|version))?',
  'anniversary(?:\\s*edition)?',
  'instrumental',
  'acoustic(?:\\s*version)?',
  'demo',
  'mono',
  'stereo',
  'explicit',
  'clean',
  'version',
  'mix',
].join('|')

const KW = `(?:${KEYWORDS})`
// Featuring credits are also noise for the title target (the featuring is scored
// separately), so strip "(feat. X)" / "- ft X" / "with X" segments too.
const FEAT = '(?:feat\\.?|ft\\.?|featuring|with)\\b[^)\\]]*'

// A bracket group ( ) or [ ] whose contents mention a junk keyword or a feat.
const BRACKET = new RegExp(`\\s*[([](?:[^)\\]]*\\b${KW}\\b[^)\\]]*|${FEAT})[)\\]]`, 'gi')
// A trailing " - <segment>" where the segment mentions a junk keyword or a feat.
const DASH = new RegExp(`\\s*[-–—]\\s*(?:[^-–—]*\\b${KW}\\b[^-–—]*|(?:feat\\.?|ft\\.?|featuring)\\b[^-–—]*)\\s*$`, 'i')

export function cleanTitle(raw: string): string {
  if (!raw) return raw
  let out = raw.replace(BRACKET, '')
  // Dash suffixes can stack ("Song - Remastered - Radio Edit"); strip repeatedly.
  let prev: string
  do {
    prev = out
    out = out.replace(DASH, '')
  } while (out !== prev)
  out = out.replace(/\s{2,}/g, ' ').trim()
  // If sanitizing nuked everything (title was only metadata), keep the original.
  return out || raw.trim()
}

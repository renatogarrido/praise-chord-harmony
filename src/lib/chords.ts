// Chord transposition + chord-pro parsing utilities
const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_KEYS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function noteIndex(note: string): number {
  const n = note[0].toUpperCase() + (note[1] === '#' || note[1] === 'b' ? note[1] : '');
  const i = SHARP_KEYS.indexOf(n);
  if (i >= 0) return i;
  const j = FLAT_KEYS.indexOf(n);
  return j >= 0 ? j : -1;
}

export function transposeNote(note: string, steps: number, useFlats = false): string {
  const idx = noteIndex(note);
  if (idx < 0) return note;
  const newIdx = ((idx + steps) % 12 + 12) % 12;
  return useFlats ? FLAT_KEYS[newIdx] : SHARP_KEYS[newIdx];
}

// Match chord like: C, Cm, C#m7, Dbmaj7, F/G, Asus4, Bm7(b5), G/B, etc.
// Simplified approach: find the root (and optional bass) and transpose them, keep the rest.
export function transposeChord(chord: string, steps: number, useFlats = false): string {
  if (!chord) return chord;
  if (steps === 0) return chord.trim();
  
  const cleanChord = chord.trim();
  
  // Handle bass notes like C/E
  const parts = cleanChord.split('/');
  const transposedParts = parts.map(part => {
    // A part starts with A-G, optionally followed by # or b
    // We use a non-greedy suffix match to avoid issues with complex chords
    const match = part.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return part;
    const [, root, suffix] = match;
    return transposeNote(root, steps, useFlats) + suffix;
  });
  
  return transposedParts.join('/');
}

export function semitonesBetween(fromKey: string, toKey: string): number {
  const a = noteIndex(fromKey);
  const b = noteIndex(toKey);
  if (a < 0 || b < 0) return 0;
  return ((b - a) % 12 + 12) % 12;
}

export const ALL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Ignore lines that look like sections [Intro], {Chorus}
  if (trimmed.match(/^\[([^\]]+)\]\s*$/) || trimmed.match(/^\{([^}]+)\}$/)) return false;
  
  // A chord line typically contains letters A-G with chord suffixes, and a lot of whitespace
  // Regex for a chord: Root(A-G) + optional accidental(#/b) + optional suffix + optional bass note
  const chordRegex = /^[A-G][#b]?(m|maj|min|M|aug|dim|sus|add|7|9|11|13|b5|#5|6|2|4|°|ø|\+)*(\([#b]?\d+\))?(\/[A-G][#b]?)?$/i;
  
  const words = trimmed.split(/\s+/);
  if (words.length === 0) return false;
  
  let chordCount = 0;
  for (const word of words) {
    // Clean word of common PDF artifacts like small dots or dashes
    const cleanWord = word.replace(/[.·-]$/, '');
    if (chordRegex.test(cleanWord)) {
      chordCount++;
    }
  }
  
  // If at least 60% of "words" are chords, or it's a very short line with at least one chord
  return (chordCount / words.length >= 0.6) || (words.length <= 3 && chordCount >= 1 && line.length > 0 && line.length < 40);
}

export function transposeChordLine(line: string, steps: number): string {
  // We want to preserve the exact spacing
  const chordRegex = /[A-G][#b]?(m|maj|min|M|aug|dim|sus|add|7|9|11|13|b5|#5|6|2|4|°|ø|\+)*(\([#b]?\d+\))?(\/[A-G][#b]?)?/gi;
  
  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = chordRegex.exec(line)) !== null) {
    result += line.slice(lastIndex, match.index);
    result += transposeChord(match[0], steps);
    lastIndex = chordRegex.lastIndex;
  }
  result += line.slice(lastIndex);
  return result;
}




// Parse a chord-pro-ish line where chords are wrapped in [ ] OR a plain "chord line" above lyric lines.
// We support: [C]Texto da [G]música  → renders chord above syllable.
// And section markers like {verse} {chorus} {bridge} or [Intro] alone on a line.
export type Token =
  | { type: 'lyric'; chord?: string; text: string }
  | { type: 'section'; label: string }
  | { type: 'comment'; text: string }
  | { type: 'break' };

export function parseLine(line: string): Token[] {
  const trimmed = line.trim();
  if (!trimmed) return [{ type: 'break' }];
  // section: {verse} {chorus} or a line that's only [Something] without lyric
  const section = trimmed.match(/^\{([^}]+)\}$/) || trimmed.match(/^\[([^\]]+)\]\s*$/);
  if (section) return [{ type: 'section', label: section[1] }];
  if (trimmed.startsWith('#')) return [{ type: 'comment', text: trimmed.slice(1).trim() }];

  // Tokenize [chord]lyric segments
  const tokens: Token[] = [];
  let i = 0;
  let pending = '';
  while (i < line.length) {
    if (line[i] === '[') {
      const end = line.indexOf(']', i);
      if (end > i) {
        if (pending) { tokens.push({ type: 'lyric', text: pending }); pending = ''; }
        const chord = line.slice(i + 1, end);
        // attach chord to next chunk until next [ or end
        i = end + 1;
        let chunk = '';
        while (i < line.length && line[i] !== '[') { chunk += line[i]; i++; }
        tokens.push({ type: 'lyric', chord, text: chunk });
        continue;
      }
    }
    pending += line[i];
    i++;
  }
  if (pending) tokens.push({ type: 'lyric', text: pending });
  return tokens.length ? tokens : [{ type: 'lyric', text: line }];
}

export function transposeAllChordsInText(text: string, steps: number): string {
  if (!steps) return text;
  return text.replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChord(chord, steps)}]`);
}

/**
 * Attempts to convert plain text with chords on top lines into ChordPro format.
 * Focuses on maintaining EXACT alignment from PDF exports.
 */
export function convertToChordPro(text: string): string {
  // Use a smaller tab width as modern PDFs often use tighter spacing
  const normalizedText = text.replace(/\t/g, "    ");
  const lines = normalizedText.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];

    // If current line is a chord line and next line is a lyric line
    if (isChordLine(currentLine) && 
        nextLine !== undefined && 
        !isChordLine(nextLine) && 
        nextLine.trim() !== "" && 
        !nextLine.trim().match(/^\[([^\]]+)\]\s*$/) && 
        !nextLine.trim().match(/^\{([^}]+)\}$/)) {
      
      let chordProLine = "";
      let lastLyricPos = 0;

      // Extract chords with their exact starting positions
      // We use a regex that matches the whole chord including suffixes
      const chordRegex = /[A-G][#b]?(m|maj|min|M|aug|dim|sus|add|7|9|11|13|b5|#5|6|2|4|°|ø|\+)*(\([#b]?\d+\))?(\/[A-G][#b]?)?/gi;
      const chordMatches: { chord: string; index: number }[] = [];
      let match;
      
      while ((match = chordRegex.exec(currentLine)) !== null) {
        chordMatches.push({ chord: match[0], index: match.index });
      }

      // If no chords found (regex mismatch but isChordLine passed), treat as plain text
      if (chordMatches.length === 0) {
        result.push(currentLine);
        continue;
      }

      // Sort matches by index to be safe
      chordMatches.sort((a, b) => a.index - b.index);

      // We need to account for the fact that PDFs often have leading spaces
      // that might not align perfectly with the lyrics.
      for (const { chord, index } of chordMatches) {
        // Find the correct insertion point in the lyrics.
        // We use the exact index from the chord line.
        const targetIndex = index;
        
        // If the chord is positioned before the current lyric position, 
        // it means multiple chords are stacked or very close.
        const safeTargetIndex = Math.max(lastLyricPos, targetIndex);
        
        // If targetIndex is beyond current nextLine length, we need to pad with spaces
        if (safeTargetIndex > nextLine.length) {
          const padding = " ".repeat(safeTargetIndex - nextLine.length);
          chordProLine += nextLine.substring(lastLyricPos) + padding + `[${chord}]`;
          lastLyricPos = nextLine.length; // We've consumed all lyrics and added padding
        } else {
          chordProLine += nextLine.substring(lastLyricPos, safeTargetIndex) + `[${chord}]`;
          lastLyricPos = safeTargetIndex;
        }
      }

      // Add remaining lyric text
      chordProLine += nextLine.substring(lastLyricPos);
      result.push(chordProLine);
      i++; // Skip the next line
    } else {
      result.push(currentLine);
    }
  }

  return result.join("\n");
}

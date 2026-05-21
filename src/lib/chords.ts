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
  
  // A chord line typically contains letters A-G with chord suffixes
  // We use a slightly more permissive regex for detection
  const chordRegex = /^[A-G][#b]?(m|maj|min|M|aug|dim|sus|add|7|9|11|13|b5|#5|6|2|4|°|ø|\+)*(\([#b]?\d+\))?(\/[A-G][#b]?)?$/i;
  
  const words = trimmed.split(/[\s\t|\-–—]+/).filter(w => w.length > 0);
  if (words.length === 0) return false;
  
  let chordCount = 0;
  let wordCount = 0;
  
  for (const word of words) {
    // Clean word of common artifacts
    const cleanWord = word.replace(/[.·,;]$/, '');
    if (chordRegex.test(cleanWord)) {
      chordCount++;
    } else if (word.match(/[a-z]{3,}/i)) {
      // If it has 3+ letters and isn't a chord, it's probably a real word
      wordCount++;
    }
  }
  
  // It's a chord line if:
  // 1. Chords outnumber real words
  // 2. Or it's short and has at least one chord and NO real words
  return (chordCount > wordCount) || (chordCount >= 1 && wordCount === 0 && trimmed.length < 60);
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
 * Optimized for accuracy even with proportional font copy-pasting.
 */
export function convertToChordPro(text: string): string {
  if (!text) return "";
  
  // Normalize tabs and remove trailing spaces
  const normalizedText = text.replace(/\t/g, "    ");
  const lines = normalizedText.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];

    // Check if current line is a chord line
    if (isChordLine(currentLine)) {
      // If there's a next line and it's NOT a chord line and not empty, merge them
      if (nextLine !== undefined && 
          !isChordLine(nextLine) && 
          nextLine.trim() !== "" && 
          !nextLine.trim().match(/^\[([^\]]+)\]\s*$/) && 
          !nextLine.trim().match(/^\{([^}]+)\}$/)) {
        
        const chordRegex = /[A-G][#b]?(m|maj|min|M|aug|dim|sus|add|7|9|11|13|b5|#5|6|2|4|°|ø|\+)*(\([#b]?\d+\))?(\/[A-G][#b]?)?/gi;
        const chords: { chord: string; index: number }[] = [];
        let match;
        
        while ((match = chordRegex.exec(currentLine)) !== null) {
          chords.push({ chord: match[0], index: match.index });
        }

        if (chords.length === 0) {
          result.push(currentLine);
          continue;
        }

        // HEURISTIC: If the chord line is significantly longer than the lyric line,
        // it might be due to trailing spaces in the PDF copy.
        // We'll use the relative position if possible.
        let chordProLine = nextLine;
        
        // Process from right to left to avoid index shifting
        const sortedChords = [...chords].sort((a, b) => b.index - a.index);
        
        for (const { chord, index } of sortedChords) {
          // Calculate insertion index
          // If next line is very short, we might need to pad it
          let targetIndex = index;
          
          // Heuristic: if index is way beyond line length, maybe it's meant to be at the end
          if (targetIndex > chordProLine.length) {
            chordProLine = chordProLine.padEnd(targetIndex, ' ');
          }

          // Insert [Chord]
          chordProLine = 
            chordProLine.slice(0, targetIndex) + 
            `[${chord}]` + 
            chordProLine.slice(targetIndex);
        }
        
        result.push(chordProLine);
        i++; // Skip next line
      } else {
        // Just wrap chords in brackets for standalone chord lines
        const chordRegex = /[A-G][#b]?(m|maj|min|M|aug|dim|sus|add|7|9|11|13|b5|#5|6|2|4|°|ø|\+)*(\([#b]?\d+\))?(\/[A-G][#b]?)?/gi;
        let match;
        let lastIdx = 0;
        let formattedLine = "";
        
        while ((match = chordRegex.exec(currentLine)) !== null) {
          formattedLine += currentLine.slice(lastIdx, match.index) + `[${match[0]}]`;
          lastIdx = chordRegex.lastIndex;
        }
        formattedLine += currentLine.slice(lastIdx);
        result.push(formattedLine);
      }
    } else {
      result.push(currentLine);
    }
  }

  return result.join("\n");
}

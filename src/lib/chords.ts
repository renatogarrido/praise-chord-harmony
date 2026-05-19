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
  
  const words = trimmed.split(/\s+/);
  if (words.length === 0) return false;
  
  let chordCount = 0;
  for (const word of words) {
    // A word is likely a chord if it matches the pattern
    // and isn't a common Portuguese word that could be mistaken (like "A", "E", "D")
    // unless it's in a line with other clear chords
    const isChord = /^[A-G][#b]?(m|maj|min|aug|dim|sus|add|7|9|11|13|b5|#5|6|°|ø)*(\/[A-G][#b]?)?$/i.test(word);
    if (isChord) {
      chordCount++;
    }
  }
  
  // If most words are chords, it's a chord line
  return chordCount / words.length >= 0.5;
}

export function transposeChordLine(line: string, steps: number): string {
  // We want to preserve the positions/spaces
  // regex to find things that look like chords
  return line.replace(/([A-G][#b]?(?:m|maj|min|aug|dim|sus|add|7|9|11|13|b5|#5|6|°|ø)*(?:\/[A-G][#b]?)?)/gi, (match) => {
    // Final check to see if it's actually a chord (to avoid transposing words that partially match)
    // We only transpose if it's followed by a space or end of string, and preceded by space or start of string
    return transposeChord(match, steps);
  });
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

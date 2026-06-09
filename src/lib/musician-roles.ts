export type MusicianOption = { value: string; label: string };
export type MusicianGroup = { label: string; options: MusicianOption[] };

export const INSTRUMENT_GROUPS: MusicianGroup[] = [
  {
    label: "Cordas dedilhadas / graves",
    options: [
      { value: "baixista_baixo_eletrico", label: "Baixista — baixo elétrico" },
      { value: "baixista_contrabaixo_acustico", label: "Baixista — contrabaixo acústico" },
      { value: "guitarrista_eletrica", label: "Guitarrista — guitarra elétrica" },
      { value: "guitarrista_semiacustica", label: "Guitarrista — guitarra semiacústica" },
      { value: "violonista_aco", label: "Violonista — violão aço" },
      { value: "violonista_nylon", label: "Violonista — violão nylon" },
      { value: "violonista_7_cordas", label: "Violonista — violão 7 cordas" },
      { value: "harpista", label: "Harpista" },
    ],
  },
  {
    label: "Teclas",
    options: [
      { value: "tecladista_teclado", label: "Tecladista — teclado" },
      { value: "tecladista_piano", label: "Tecladista — piano" },
      { value: "tecladista_synth", label: "Tecladista — synth" },
      { value: "pianista", label: "Pianista" },
      { value: "acordeonista", label: "Acordeonista / Sanfoneiro" },
    ],
  },
  {
    label: "Percussão",
    options: [
      { value: "baterista", label: "Baterista" },
      { value: "percussionista", label: "Percussionista (congas, bongô, pandeiro, cajón…)" },
    ],
  },
  {
    label: "Sopros",
    options: [
      { value: "saxofonista_alto", label: "Saxofonista — alto" },
      { value: "saxofonista_tenor", label: "Saxofonista — tenor" },
      { value: "saxofonista_baritono", label: "Saxofonista — barítono" },
      { value: "trompetista", label: "Trompetista" },
      { value: "trombonista", label: "Trombonista" },
      { value: "flautista_doce", label: "Flautista — flauta doce" },
      { value: "flautista_transversal", label: "Flautista — transversal" },
      { value: "clarinetista", label: "Clarinetista" },
      { value: "gaitista", label: "Gaitista (harmônica)" },
    ],
  },
  {
    label: "Cordas orquestrais",
    options: [
      { value: "violinista", label: "Violinista" },
      { value: "violista", label: "Violista (viola de orquestra)" },
      { value: "violoncelista", label: "Violoncelista" },
    ],
  },
];

export const VOCAL_GROUPS: MusicianGroup[] = [
  {
    label: "Voz feminina",
    options: [
      { value: "soprano", label: "Soprano (mais aguda)" },
      { value: "mezzosoprano", label: "Mezzosoprano (intermediária)" },
      { value: "contralto", label: "Contralto (mais grave)" },
    ],
  },
  {
    label: "Voz masculina",
    options: [
      { value: "tenor", label: "Tenor (mais aguda)" },
      { value: "baritono", label: "Barítono (intermediária)" },
      { value: "baixo_vocal", label: "Baixo (mais grave)" },
    ],
  },
];

export const TECHNICAL_GROUPS: MusicianGroup[] = [
  {
    label: "Equipe Técnica",
    options: [
      { value: "tecnico_som", label: "Técnico de Som" },
      { value: "iluminacao", label: "Iluminação" },
      { value: "telao", label: "Telão" },
    ],
  },
];

const allInstruments = INSTRUMENT_GROUPS.flatMap((g) => g.options);
const allVocals = VOCAL_GROUPS.flatMap((g) => g.options);
const allTechnical = TECHNICAL_GROUPS.flatMap((g) => g.options);

export function instrumentLabel(value: string) {
  return allInstruments.find((o) => o.value === value)?.label ?? value;
}
export function vocalLabel(value: string) {
  return allVocals.find((o) => o.value === value)?.label ?? value;
}
export function technicalLabel(value: string) {
  return allTechnical.find((o) => o.value === value)?.label ?? value;
}

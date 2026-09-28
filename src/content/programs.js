// Source: ibsu.edu.ge/entrant/tuition-fees + /entrant/calculation (checked 2026-09-28).
// fee = annual tuition in GEL for Georgian applicants. langs = languages of instruction.
export const SCHOOLS = ['business', 'csa', 'ehss', 'law', 'medicine'];

export const PROGRAMS = [
  { id: 'marketing', school: 'business', fee: 4490, langs: ['ka', 'en'] },
  { id: 'management', school: 'business', fee: 4490, langs: ['ka', 'en'] },
  { id: 'finance', school: 'business', fee: 4490, langs: ['ka', 'en'] },
  { id: 'accounting', school: 'business', fee: 4490, langs: ['ka', 'en'] },
  { id: 'economics', school: 'business', fee: 3190, langs: ['ka', 'en'] },
  { id: 'tourism', school: 'business', fee: 3190, langs: ['ka'] },
  { id: 'cs', school: 'csa', fee: 4990, langs: ['ka', 'en'] },
  { id: 'architecture', school: 'csa', fee: 5990, langs: ['ka', 'en'], creative: true },
  { id: 'graphic', school: 'csa', fee: 4590, langs: ['en'], creative: true },
  { id: 'ir', school: 'ehss', fee: 5190, langs: ['ka', 'en'] },
  { id: 'psychology', school: 'ehss', fee: 3990, langs: ['ka', 'en'] },
  { id: 'pr', school: 'ehss', fee: 5190, langs: ['ka'] },
  { id: 'journalism', school: 'ehss', fee: 3990, langs: ['ka'] },
  { id: 'english', school: 'ehss', fee: 4190, langs: ['en'] },
  { id: 'american', school: 'ehss', fee: 3190, langs: ['en'] },
  { id: 'law', school: 'law', fee: 4590, langs: ['ka'] },
  { id: 'publicadmin', school: 'law', fee: 4590, langs: ['ka'] },
  { id: 'medicine', school: 'medicine', fee: 6190, langs: ['en'] },
];

// Internal grants — only the highest single grant applies.
export const GRANTS = [
  { id: 'top50', pct: 50 },
  { id: 'gold', pct: 50 },
  { id: 'top150', pct: 25 },
  { id: 'priority', pct: 20 },
  { id: 'creative', pct: 20, creativeOnly: true },
];

export const INSTALMENT_MONTHS = 8;

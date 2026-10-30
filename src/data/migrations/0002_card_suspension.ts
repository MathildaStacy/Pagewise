/** Keep the learning schedule and history when a card is paused. */
export const m0002 = [
  'ALTER TABLE card ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0 CHECK (suspended IN (0,1))',
];

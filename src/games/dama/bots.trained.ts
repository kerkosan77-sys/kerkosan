// Made by scripts/train-bots (do not edit by hand): the bots of the eight levels, weakest first.
// Trained on 2026-11-28 from 1700 games between the bots of the training ladder;
// the comments give each level's strength measured against level 1.
import type { BotStyle } from '../../core/humanize'

export const TRAINED_BOTS: (BotStyle & { maxMs?: number })[] = [
  {depth: 1, humanize: {multiPV: 8, temperature: 300, randomMoveChance: 0.3}}, // 1. düzey: +0 Elo
  {depth: 1, humanize: {multiPV: 8, temperature: 219, randomMoveChance: 0.178}}, // 2. düzey: +168 Elo
  {depth: 1, deeper: 0.83, humanize: {multiPV: 8, temperature: 150, randomMoveChance: 0.092}}, // 3. düzey: +336 Elo
  {depth: 2, deeper: 0.65, humanize: {multiPV: 8, temperature: 108, randomMoveChance: 0.054}}, // 4. düzey: +637 Elo
  {depth: 3, deeper: 0.58, humanize: {multiPV: 8, temperature: 70, randomMoveChance: 0.028}}, // 5. düzey: +997 Elo
  {depth: 4, deeper: 0.36, humanize: {multiPV: 6, temperature: 46, randomMoveChance: 0.016}}, // 6. düzey: +1238 Elo
  {depth: 5, deeper: 0.63, humanize: {multiPV: 6, temperature: 19, randomMoveChance: 0.004}}, // 7. düzey: +1523 Elo
  {depth: 14, maxMs: 3500}, // 8. düzey: +1931 Elo
]

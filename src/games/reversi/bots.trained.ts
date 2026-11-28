// Made by scripts/train-bots (do not edit by hand): the bots of the eight levels, weakest first.
// Trained on 2026-11-28 from 1140 games between the bots of the training ladder;
// the comments give each level's strength measured against level 1.
import type { BotStyle } from '../../core/humanize'

export const TRAINED_BOTS: (BotStyle & { maxMs?: number })[] = [
  {depth: 1, humanize: {multiPV: 8, temperature: 150, randomMoveChance: 0.3}}, // 1. düzey: +0 Elo
  {depth: 1, deeper: 0.46, humanize: {multiPV: 8, temperature: 86, randomMoveChance: 0.118}}, // 2. düzey: +162 Elo
  {depth: 2, deeper: 0.49, humanize: {multiPV: 8, temperature: 58, randomMoveChance: 0.061}}, // 3. düzey: +349 Elo
  {depth: 3, deeper: 0.33, humanize: {multiPV: 8, temperature: 39, randomMoveChance: 0.033}}, // 4. düzey: +563 Elo
  {depth: 3, deeper: 0.92, humanize: {multiPV: 8, temperature: 29, randomMoveChance: 0.022}}, // 5. düzey: +810 Elo
  {depth: 5, humanize: {multiPV: 6, temperature: 15, randomMoveChance: 0.01}}, // 6. düzey: +1094 Elo
  {depth: 5, deeper: 0.4, humanize: {multiPV: 4, temperature: 4, randomMoveChance: 0}}, // 7. düzey: +1420 Elo
  {depth: 12, maxMs: 3000}, // 8. düzey: +1795 Elo
]

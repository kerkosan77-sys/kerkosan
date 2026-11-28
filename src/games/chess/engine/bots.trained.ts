// Made by scripts/train-bots (do not edit by hand): the bots of the eight levels, weakest first.
// Trained on 2026-11-28 from 2280 games between the bots of the training ladder;
// the comments give each level's strength measured against level 1.
import type { BotStyle } from '../../../core/humanize'

export const CHESS_BOTS: BotStyle[] = [
  {depth: 2, humanize: {multiPV: 8, temperature: 250, randomMoveChance: 0.22}}, // 1. düzey: +0 Elo
  {depth: 2, humanize: {multiPV: 8, temperature: 198, randomMoveChance: 0.145}}, // 2. düzey: +245 Elo
  {depth: 2, deeper: 0.53, humanize: {multiPV: 8, temperature: 154, randomMoveChance: 0.094}}, // 3. düzey: +526 Elo
  {depth: 3, deeper: 0.49, humanize: {multiPV: 6, temperature: 110, randomMoveChance: 0.055}}, // 4. düzey: +850 Elo
  {depth: 4, deeper: 0.83, humanize: {multiPV: 5, temperature: 65, randomMoveChance: 0.023}}, // 5. düzey: +1222 Elo
  {depth: 6, deeper: 0.26, humanize: {multiPV: 3, temperature: 30, randomMoveChance: 0.007}}, // 6. düzey: +1650 Elo
  {depth: 8, deeper: 0.06}, // 7. düzey: +2142 Elo
  {depth: 14}, // 8. düzey: +2708 Elo
]

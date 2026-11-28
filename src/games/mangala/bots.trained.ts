// Made by scripts/train-bots (do not edit by hand): the bots of the eight levels, weakest first.
// Trained on 2026-11-28 from 21600 games between the bots of the training ladder;
// the comments give each level's strength measured against level 1.
import type { BotStyle } from '../../core/humanize'

export const TRAINED_BOTS: BotStyle[] = [
  {depth: 1, humanize: {multiPV: 6, temperature: 300, randomMoveChance: 0.3}}, // 1. düzey: +0 Elo
  {depth: 1, deeper: 0.37, humanize: {multiPV: 6, temperature: 178, randomMoveChance: 0.124}}, // 2. düzey: +70 Elo
  {depth: 1, deeper: 0.74, humanize: {multiPV: 6, temperature: 155, randomMoveChance: 0.098}}, // 3. düzey: +151 Elo
  {depth: 2, deeper: 0.36, humanize: {multiPV: 6, temperature: 122, randomMoveChance: 0.065}}, // 4. düzey: +254 Elo
  {depth: 4, deeper: 0.19, humanize: {multiPV: 6, temperature: 50, randomMoveChance: 0.018}}, // 5. düzey: +351 Elo
  {depth: 6, deeper: 0.73, humanize: {multiPV: 4, temperature: 3, randomMoveChance: 0}}, // 6. düzey: +481 Elo
  {depth: 10, deeper: 0.55}, // 7. düzey: +629 Elo
  {depth: 14}, // 8. düzey: +820 Elo
]

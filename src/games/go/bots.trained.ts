// Made by scripts/train-bots (do not edit by hand): the bots of the eight levels, weakest first.
// Trained on 2026-11-28 from 760 games between the bots of the training ladder;
// the comments give each level's strength measured against level 1.
import type { Humanize } from '../../core/humanize'

export const TRAINED_BOTS: { playouts: number; humanize?: Humanize }[] = [
  {playouts: 150, humanize: {multiPV: 10, temperature: 800, randomMoveChance: 0.3}}, // 1. düzey: +0 Elo
  {playouts: 210, humanize: {multiPV: 10, temperature: 672, randomMoveChance: 0.223}}, // 2. düzey: +208 Elo
  {playouts: 340, humanize: {multiPV: 8, temperature: 522, randomMoveChance: 0.139}}, // 3. düzey: +447 Elo
  {playouts: 710, humanize: {multiPV: 8, temperature: 336, randomMoveChance: 0.066}}, // 4. düzey: +722 Elo
  {playouts: 1370, humanize: {multiPV: 8, temperature: 205, randomMoveChance: 0.031}}, // 5. düzey: +1038 Elo
  {playouts: 2740, humanize: {multiPV: 6, temperature: 114, randomMoveChance: 0.015}}, // 6. düzey: +1401 Elo
  {playouts: 6480, humanize: {multiPV: 4, temperature: 20, randomMoveChance: 0}}, // 7. düzey: +1819 Elo
  {playouts: 30000}, // 8. düzey: +2300 Elo
]

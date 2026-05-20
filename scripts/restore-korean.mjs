import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const allRoundsPath = path.join(root, 'src/screens/AllRounds.tsx');
const roundSummaryPath = path.join(root, 'src/screens/RoundSummary.tsx');

const allRounds = fs.readFileSync(path.join(root, 'src/screens/NewRound.tsx'), 'utf8');
// Use NewRound as encoding reference - write full AllRounds from embedded UTF-8 file

const allRoundsContent = `import { useEffect, useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { missPatternKey } from '../lib/missPattern';
import type { Round, Hole } from '../types';

interface Props {
  onRoundSelect?: (round: Round) => void;
}

interface RoundWithHoles {
  round: Round;
  holes: Hole[];
  totalStrokes: number;
  totalPar: number;
  overPar: number;
  totalPutts: number;
  threePuttPlus: number;
  penalties: number;
  gir: number;
  fairwayHits: number;
  fairwayDenom: number;
  doubleOrWorse: number;
  birdie: number;
  parHoles: number;
  bogey: number;
  double: number;
  triple: number;
}

const PENALTY_MAP: Record<string, number> = { OB: 2, '${'\uD574\uC800\uB4DC'}': 1 };

function computeHoleStats(holes: Hole[]): Omit<RoundWithHoles, 'round' | 'holes'> {
  const totalStrokes = holes.reduce((s, h) => s + h.total_strokes, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const overPar = totalStrokes - totalPar;
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const threePuttPlus = holes.filter(h => h.putts >= 3).length;
  const doubleOrWorse = holes.filter(h => h.over_par >= 2).length;
  const penalties = holes.reduce((s, h) => {
    let pen = 0;
    for (const p of [h.tee_penalty_type, h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      pen += PENALTY_MAP[p] ?? 0;
    }
    return s + pen;
  }, 0);
  const gir = holes.filter(h => h.green_shots <= h.par - 2 && h.green_shots > 0).length;
  const fairwayDenom = holes.filter(h => h.par !== 3).length;
  const fairwayHits = holes.filter(h => h.par !== 3 && h.tee_result === '${'\uD398\uC5B4\uC6E8\uC774'}').length;
  const birdie = holes.filter(h => h.over_par <= -1).length;
  const parHoles = holes.filter(h => h.over_par === 0).length;
  const bogey = holes.filter(h => h.over_par === 1).length;
  const double = holes.filter(h => h.over_par === 2).length;
  const triple = holes.filter(h => h.over_par >= 3).length;
  return { totalStrokes, totalPar, overPar, totalPutts, threePuttPlus, penalties, gir, fairwayHits, fairwayDenom, doubleOrWorse, birdie, parHoles, bogey, double, triple };
}
`;

// Too long for template - use read corrupted and replace instead
let ar = fs.readFileSync(allRoundsPath, 'utf8');

const arReplacements = [
  ["'???'", "'\uD574\uC800\uB4DC'"],
  ["'????'", "'\uD398\uC5B4\uC6E8\uC774'"],
  ["'????'", "'\uB4DC\uB77C\uC774\uBC84'"],
  ["'???'", "'\uC544\uC774\uC5B8'"],
  ["'????'", "'\uC5B4\uD504\uB85C\uCE58'"],
  ["'??'", "'\uD37C\uD130'"],
  ['???? ?...', '\uBD88\uB7EC\uC624\uB294 \uC911...'],
  ['?? ??', '\uC804\uCCB4 \uD1B5\uACC4'],
  ['?? 6??? ??', '\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uAE30\uC900'],
  ['??? ???? ????', '\uC800\uC7A5\uB41C \uB77C\uC6B4\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'],
  ['?? ?? ???', '\uB098\uC758 \uAC1C\uC120 \uD3EC\uC778\uD2B8'],
  ['?? ????', '\uBBF8\uC2A4 \uB370\uC774\uD130'],
  ['?? ???', '\uD3C9\uADE0 \uC624\uBC84\uD30C'],
  ['?? ??', '\uD3C9\uADE0 \uD0C0\uC218'],
  ['?? ??', '\uD3C9\uADE0 \uD37C\uD305'],
  ['>???<', '>\uD0C0<'],
  ['>??<', '>\uAC1C<'],
  ['??? ??', '\uC2A4\uCF54\uC5B4 \uBD84\uD3EC'],
  ['?? ??', '\uBC84\uB514 \uC774\uD558'],
  ["label: '??'", "label: '\uBCF4\uAE30'"],
  ["label: '??'", "label: '\uB354\uBE14'"],
  ['???+', '\uD2B8\uB9AC\uD50C+'],
  ['? ???', '\uC0F7 \uC815\uD655\uB3C4'],
  ['???? ???', '\uD398\uC5B4\uC6E8\uC774 \uC548\uCC29\uB960'],
  ['?? ?? ?', '\uD3C9\uADE0 \uD37C\uD305 \uC218'],
  ['3?? ??', '3\uD37C\uD305 \uC774\uC0C1'],
  ['???? ??', '\uB354\u블보기 이상'.replace('블', '\uBE14')], // fix
];

// Fix the typo in last entry
arReplacements[arReplacements.length - 1] = ['???? ??', '\uB354\uBE14\uBCF4\uAE30 \uC774\uC0C1'];

const moreAr = [
  ['?? ??', '\uBCA8\uD0C0 \uC190\uC2E4'],
  ['?? ?? TOP 3', '\uBBF8\uC2A4 \uC720\uD615 TOP 3'],
  ['??? ?? ?? ??', '\uB77C\uC6B4\uB4DC \uD3C9\uADE0 \uBC1C\uC0DD \uD69F\uC218'],
  ['?? {a}?', '\uD3C9\uADE0 {a}\uD68C'],
  ['??? ?? ??', '\uD074\uB7FD\uBCC4 \uBBF8\uC2A4 \uD69F\uC218'],
  ['??? ??', '\uB77C\uC6B4\uB4DC \uD3C9\uADE0'],
  ['??? ???', '\uBCA0\uC2A4\uD2B8 \uC2A4\uCF54\uC5B4'],
  ['??? ??', '\uC62C\uD0C0\uC784 \uCD5C\uC800'],
  ['?? 6??? ??', '\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uCD5C\uC800'],
  ['${avgGir}?', '${avgGir}\uD648'],
  ['${avgPutts}?', '${avgPutts}\uAC1C'],
  ['${avg3Putt}?', '${avg3Putt}\uD648'],
  ['${avgDbl}?', '${avgDbl}\uD648'],
  ['${avgPenalty}?', '${avgPenalty}\uD0C0'],
  ['totalStrokes}?', 'totalStrokes}\uD0C0'],
];

for (const [from, to] of [...arReplacements, ...moreAr]) {
  ar = ar.split(from).join(to);
}

// Miss messages - multi-line patterns need special handling
ar = ar.replace(
  /`"\$\{topMiss\.type\}" \?\?\? \?\?\?\? \?\? \$\{topMiss\.avg\}\? \?\?\?\? \?\?\?/g,
  '`"${topMiss.type}" \uBBF8\uC2A4\uAC00 \uB77C\uC6B4\uB4DC\uB2F9 \uD3C9\uADE0 ${topMiss.avg}\uD68C \uBC1C\uC0DD'
);

fs.writeFileSync(allRoundsPath, ar, 'utf8');
console.log('AllRounds partial fix done - may need manual review');

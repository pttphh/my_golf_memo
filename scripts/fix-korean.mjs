import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixFile(relPath, replacements) {
  const filePath = path.join(root, relPath);
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed:', relPath);
}

const H = '\uD574\uC800\uB4DC'; // 해저드
const F = '\uD398\uC5B4\uC6E8\uC774'; // 페어웨이
const D = '\uB4DC\uB77C\uC774\uBC84'; // 드라이버
const I = '\uC544\uC774\uC5B8'; // 아이언
const A = '\uC5B4\uD504\uB85C\uCE58'; // 어프로치
const P = '\uD37C\uD130'; // 퍼터

fixFile('src/screens/AllRounds.tsx', [
  ["'???'", `'${H}'`],
  ["tee_result === '????'", `tee_result === '${F}'`],
  ["{ '????': 0, '???': 0, '????': 0, '??': 0 }", `{ '${D}': 0, '${I}': 0, '${A}': 0, '${P}': 0 }`],
  ["clubMissRaw['????']", `clubMissRaw['${D}']`],
  ["clubMissRaw['???']", `clubMissRaw['${I}']`],
  ["clubMissRaw['????']", `clubMissRaw['${A}']`],
  ["clubMissRaw['??']", `clubMissRaw['${P}']`],
  ["(['????', '???', '????', '??']", `(['${D}', '${I}', '${A}', '${P}']`],
  ['???? ?...', '\uBD88\uB7EC\uC624\uB294 \uC911...'],
  ['>?? ??<', '>\uC804\uCCB4 \uD1B5\uACC4<'],
  ['>?? 6??? ??<', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uAE30\uC900<'],
  ['??? ???? ????', '\uC800\uC7A5\uB41C \uB77C\uC6B4\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'],
  ['>?? ?? ???<', '>\uB098\uC758 \uAC1C\uC120 \uD3EC\uC778\uD2B8<'],
  ['?? ???? ?????. ? ??? ? ??????.', '\uBBF8\uC2A4 \uB370\uC774\uD130\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4. \uD640 \uAE30\uB85D\uC744 \uB354 \uC785\uB825\uD574\uBCF4\uC138\uC694.'],
  ['>?? 6??? ??<', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uD3C9\uADE0<'],
  ['>?? ???<', '>\uD3C9\uADE0 \uC624\uBC84\uD30C<'],
  ['>?? ??<', '>\uD3C9\uADE0 \uD0C0\uC218<'],
  ['>?? ??<', '>\uD3C9\uADE0 \uD37C\uD305<'],
  ['ml-0.5">???<', 'ml-0.5">\uD0C0<'],
  ['ml-0.5">??<', 'ml-0.5">\uAC1C<'],
  ['>??? ?? (??? ?? ? ?)<', '>\uC2A4\uCF54\uC5B4 \uBD84\uD3EC (\uB77C\uC6B4\uB4DC \uD3C9\uADE0 \uD648 \uC218)<'],
  ["label: '?? ??'", "label: '\uBC84\uB514 \uC774\uD558'"],
  ["label: '??'", "label: '\uBCF4\uAE30'"],
  ["label: '??'", "label: '\uB354\uBE14'"],
  ["label: '???+'", "label: '\uD2B8\uB9AC\uD50C+'"],
  ['>? ???<', '>\uC0F7 \uC815\uD655\uB3C4<'],
  ["label: '???? ???'", "label: '\uD398\uC5B4\uC6E8\uC774 \uC548\uCC29\uB960'"],
  ['${avgGir}?`', '${avgGir}\uD648`'],
  ["label: '?? ?? ?'", "label: '\uD3C9\uADE0 \uD37C\uD305 \uC218'"],
  ['${avgPutts}?`', '${avgPutts}\uAC1C`'],
  ["label: '3?? ??'", "label: '3\uD37C\uD305 \uC774\uC0C1'"],
  ['${avg3Putt}?`', '${avg3Putt}\uD648`'],
  ["label: '???? ??'", "label: '\uB354\uBE14\uBCF4\uAE30 \uC774\uC0C1'"],
  ['${avgDbl}?`', '${avgDbl}\uD648`'],
  ["label: '?? ??'", "label: '\uBCA8\uD0C0 \uC190\uC2E4'"],
  ['${avgPenalty}?`', '${avgPenalty}\uD0C0`'],
  ['>?? ?? TOP 3<', '>\uBBF8\uC2A4 \uC720\uD615 TOP 3<'],
  ['>??? ?? ?? ??<', '>\uB77C\uC6B4\uB4DC \uD3C9\uADE0 \uBC1C\uC0DD \uD69F\uC218<'],
  ['>?? {a}?<', '>\uD3C9\uADE0 {a}\uD68C<'],
  ['>??? ?? ??<', '>\uD074\uB7FD\uBCC4 \uBBF8\uC2A4 \uD69F\uC218<'],
  ['>??? ??<', '>\uB77C\uC6B4\uB4DC \uD3C9\uADE0<'],
  ['>??? ???<', '>\uBCA0\uC2A4\uD2B8 \uC2A4\uCF54\uC5B4<'],
  ['>??? ??<', '>\uC62C\uD0C0\uC784 \uCD5C\uC800<'],
  ['>?? 6??? ??<', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uCD5C\uC800<'],
  ['totalStrokes}?<', 'totalStrokes}\uD0C0<'],
  [' ??? ???? ?? ', ' \uBBF8\uC2A4\uAC00 \uB77C\uC6B4\uB4DC\uB2F9 \uD3C9\uADE0 '],
  [' ? ???? ', ' \uD68C \uBC1C\uC0DD\uD558\uACE0 \uC788\uC73C\uBA70, '],
  [' ??? ?? ????. ?? ??? ?????.', ' \uBBF8\uC2A4\uAC00 \uAC00\uC7A5 \uB9CE\uC2B5\uB2C8\uB2E4. \uC9D1\uC911 \uC5F0\uC2B5\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'],
  [' ? ???? ?? ', ' \uBBF8\uC2A4\uAC00 \uB77C\uC6B4\uB4DC\uB2F9 \uD3C9\uADE0 '],
  [' ? ???? ????.', ' \uD68C \uBC1C\uC0DD\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.'],
  [' ??? ?? ?? ???? ????.', ' \uBBF8\uC2A4\uAC00 \uAC00\uC7A5 \uB9CE\uC774 \uBC1C\uC0DD\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.'],
]);

fixFile('src/screens/RoundSummary.tsx', [
  ['>??? ??<', '>\uB77C\uC6B4\uB4DC \uC0AD\uC81C<'],
  ['? ???? ?????????', '\uC774 \uB77C\uC6B4\uB4DC\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'],
  ['??? ???? ??? ? ????.', '\uC0AD\uC81C\uB41C \uB370\uC774\uD130\uB294 \uBCF5\uAD6C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'],
  ['>??<', '>\uCDE8\uC18C<'],
  ['?? ?...', '\uC0AD\uC81C \uC911...'],
  ['??', '\uC0AD\uC81C'],
  ['???? ?...', '\uBD88\uB7EC\uC624\uB294 \uC911...'],
  [`'???'`, `'${H}'`],
  [`tee_result === '????'`, `tee_result === '${F}'`],
  ['>?? {round.course_front}<', '>\uC804\uBC18 {round.course_front}<'],
  ['>?? {round.course_back}<', '>\uD6C4\uBC18 {round.course_back}<'],
  ['? ??? ????.', '\uD640 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'],
  ['{totalStrokes}?<', '{totalStrokes}\uD0C0<'],
  ['{overSign} ???<', '{overSign} \uC624\uBC84\uD30C<'],
  ['>?? (1-9?)<', '>\uC804\uBC18 (1-9\uD640)<'],
  ['>?? (10-18?)<', '>\uD6C4\uBC18 (10-18\uD640)<'],
  ['>?? ?? ??<', '>\uD640\uBCC4 \uACB0\uACFC \uBD84\uD3EC<'],
  ["label: '???'", "label: '\uBC84\uB514\u2193'"],
  ["label: '??'", "label: '\uBCF4\uAE30'"],
  ["label: '??'", "label: '\uB354\uBE14'"],
  ["label: '????'", "label: '\uD2B8\uB9AC\uD50C\u2191'"],
  ["label: '???? ???'", "label: '\uD398\uC5B4\uC6E8\uC774 \uC548\uCC29\uB960'"],
  ['sub="?? ?? ?"', 'sub="\uADF8\uB9B0 \uC801\uC911 \uD640"'],
  ['label="3??+"', 'label="3\uD37C\uD305+"'],
  ['`${threePuttPlus}?`', '`${threePuttPlus}\uD640`'],
  ['sub="3?? ??"', 'sub="3\uD37C\uD305 \uC774\uC0C1"'],
  ['label="? ??"', 'label="\uCD1D \uD37C\uD305"'],
  ['`${totalPutts}?`', '`${totalPutts}\uAC1C`'],
  ['label="?? ??"', 'label="\uB354\uBE14 \uC774\uC0C1"'],
  ['sub="???? ??"', 'sub="\uB354\uBE14\uBCF4\uAE30 \uC774\uC0C1"'],
  ['label="?? ??"', 'label="\uBCA8\uD0C0 \uC190\uC2E4"'],
  ['`${penalties}?`', '`${penalties}\uD0C0`'],
  ['sub="OB2, ???1"', 'sub="OB\u00D72, \uD574\uC800\uB4DC\u00D71"'],
  ['?? ?? ?? ??', '\uBBF8\uC2A4 \uC720\uD615 \uC9D1\uACC4 \uBCF4\uAE30'],
  ['? ? ?? ??', '\uAC01 \uD640 \uAE30\uB85D \uBCF4\uAE30'],
  ['??? ?? ??', '\uB77C\uC6B4\uB4DC \uC800\uC7A5 \uC644\uB8CC'],
  ['? ??? ??', '\uC774 \uB77C\uC6B4\uB4DC \uC0AD\uC81C'],
]);

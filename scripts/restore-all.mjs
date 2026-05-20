import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = '\uB4DC\uB77C\uC774\uBC84';
const I = '\uC544\uC774\uC5B8';
const A = '\uC5B4\uD504\uB85C\uCE58';
const P = '\uD37C\uD130';
const H = '\uD574\uC800\uB4DC';
const F = '\uD398\uC5B4\uC6E8\uC774';

function fix(rel, reps) {
  const p = path.join(root, rel);
  let c = fs.readFileSync(p, 'utf8');
  for (const [from, to] of reps) c = c.split(from).join(to);
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK', rel);
}

fix('src/screens/AllRounds.tsx', [
  ["{ OB: 2, '???': 1 }", `{ OB: 2, '${H}': 1 }`],
  ["tee_result === '????'", `tee_result === '${F}'`],
  [`{ '????': 0, '???': 0, '????': 0, '??': 0 }`, `{ '${D}': 0, '${I}': 0, '${A}': 0, '${P}': 0 }`],
  ["clubMissRaw['????']", `clubMissRaw['${D}']`],
  ["clubMissRaw['???']", `clubMissRaw['${I}']`],
  ["clubMissRaw['????']", `clubMissRaw['${A}']`],
  ["clubMissRaw['??']", `clubMissRaw['${P}']`],
  [`(['????', '???', '????', '??']`, `(['${D}', '${I}', '${A}', '${P}']`],
  ['???? ?...', '\uBD88\uB7EC\uC624\uB294 \uC911...'],
  ['>?? ??<', '>\uC804\uCCB4 \uD1B5\uACC4<'],
  ['>?? 6??? ??<', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uAE30\uC900<'],
  ['??? ???? ????', '\uC800\uC7A5\uB41C \uB77C\uC6B4\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'],
  ['>?? ?? ???<', '>\uB098\uC758 \uAC1C\uC120 \uD3EC\uC778\uD2B8<'],
  ['?? ???? ?????. ? ??? ? ??????.', '\uBBF8\uC2A4 \uB370\uC774\uD130\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4. \uD640 \uAE30\uB85D\uC744 \uB354 \uC785\uB825\uD574\uBCF4\uC138\uC694.'],
  ['>?? 6??? ??<', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uD3C9\uADE0<'],
  ['>?? ???<', '>\uD3C9\uADE0 \uC624\uBC84\uD30C<'],
  ['text-gray-800">{avgScore}<span className="text-xs font-normal text-gray-500 ml-0.5">?</span>',
   'text-gray-800">{avgScore}<span className="text-xs font-normal text-gray-500 ml-0.5">\uD0C0</span>'],
  ['text-blue-500">{avgPutts}<span className="text-xs font-normal text-gray-500 ml-0.5">?</span>',
   'text-blue-500">{avgPutts}<span className="text-xs font-normal text-gray-500 ml-0.5">\uAC1C</span>'],
  ['text-center px-2">\n                  <p className="text-[11px] text-gray-500 mb-1">?? ??<',
   'text-center px-2">\n                  <p className="text-[11px] text-gray-500 mb-1">\uD3C9\uADE0 \uD0C0\uC218<'],
  ['text-center pl-2">\n                  <p className="text-[11px] text-gray-500 mb-1">?? ??<',
   'text-center pl-2">\n                  <p className="text-[11px] text-gray-500 mb-1">\uD3C9\uADE0 \uD37C\uD305<'],
  ['>??? ?? (??? ?? ? ?)<', '>\uC2A4\uCF54\uC5B4 \uBD84\uD3EC (\uB77C\uC6B4\uB4DC \uD3C9\uADE0 \uD648 \uC218)<'],
  ["label: '?? ??'", "label: '\uBC84\uB514 \uC774\uD558'"],
  ["label: '?'", "label: '\uD30C'"],
  ["label: '??'", "label: '\uBCF4\uAE30'"],
  ["label: '??'", "label: '\uB354\uBE14'"],
  ["label: '???+'", "label: '\uD2B8\uB9AC\uD50C+'"],
  ['>? ???<', '>\uC0F7 \uC815\uD655\uB3C4<'],
  ["label: '???? ???'", `label: '${F} \uC548\uCC29\uB960'`],
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
  ['course_name} ? {', 'course_name} \u00B7 {'],
  ['totalStrokes}?', 'totalStrokes}\uD0C0'],
  [' ??? ???? ?? ', ' \uBBF8\uC2A4\uAC00 \uB77C\uC6B4\uB4DC\uB2F9 \uD3C9\uADE0 '],
  ['? ???? ???,', '\uD68C \uBC1C\uC0DD\uD558\uACE0 \uC788\uC73C\uBA70,'],
  [' ??? ?? ????. ?? ??? ?????.', ' \uBBF8\uC2A4\uAC00 \uAC00\uC7A5 \uB9CE\uC2B5\uB2C8\uB2E4. \uC9D1\uC911 \uC5F0\uC2B5\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'],
  ['? ???? ????.', '\uD68C \uBC1C\uC0DD\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.'],
  [' ??? ?? ?? ???? ????.', ' \uBBF8\uC2A4\uAC00 \uAC00\uC7A5 \uB9CE\uC774 \uBC1C\uC0DD\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.'],
]);

fix('src/screens/RoundSummary.tsx', [
  ["{ OB: 2, '???': 1 }", `{ OB: 2, '${H}': 1 }`],
  ["tee_result === '????'", `tee_result === '${F}'`],
  ['???? ?...', '\uBD88\uB7EC\uC624\uB294 \uC911...'],
  ['>?? {round.course_front}<', '>\uC804\uBC18 {round.course_front}<'],
  ['>?? {round.course_back}<', '>\uD6C4\uBC18 {round.course_back}<'],
  ['? ??? ????.', '\uD640 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'],
  ['{totalStrokes}?', '{totalStrokes}\uD0C0'],
  ['{overSign} ???', '{overSign} \uC624\uBC84\uD30C'],
  ['>?? (1-9?)<', '>\uC804\uBC18 (1-9\uD640)<'],
  ['>?? (10-18?)<', '>\uD6C4\uBC18 (10-18\uD640)<'],
  ['>?? ?? ??<', '>\uD640\uBCC4 \uACB0\uACFC \uBD84\uD3EC<'],
  ["label: '???'", "label: '\uBC84\uB514\u2193'"],
  ["label: '?'", "label: '\uD30C'"],
  ["label: '??'", "label: '\uBCF4\uAE30'"],
  ["label: '??'", "label: '\uB354\uBE14'"],
  ["label: '????'", "label: '\uD2B8\uB9AC\uD50C\u2191'"],
  ['label="\uC0AD\uC81C\uC0AD\uC81C', `label="${F} \uC548\uCC29\uB960`],
  ['sub="\uC0AD\uC81C', 'sub="\uADF8\uB9B0'],
  ['label="3\uC0AD\uC81C+', 'label="3\uD37C\uD305+'],
  ['label="? \uC0AD\uC81C"', 'label="\uCD1D \uD37C\uD305"'],
  ['label="\uC0AD\uC81C \uC0AD\uC81C"', 'label="\uB354\uBE14 \uC774\uC0C1"'],
  ['sub="\uC0AD\uC81C\uC0AD\uC81C', 'sub="\uB354\uBE14\uBCF4\uAE30'],
  ['label="\uC0AD\uC81C \uC0AD\uC81C"', 'label="\uBCA8\uD0C0 \uC190\uC2E4"'],
  ['sub="OB', 'sub="OB\u00D72'],
  ['\uC0AD\uC81C?1"', '\uD574\uC800\uB4DC\u00D71"'],
  ['\uC0AD\uC81C \uC0AD\uC81C \uC0AD\uC81C \uC0AD\uC81C', '\uBBF8\uC2A4 \uC720\uD615 \uC9D1\uACC4 \uBCF4\uAE30'],
  ['? ? \uC0AD\uC81C \uC0AD\uC81C', '\uAC01 \uD640 \uAE30\uB85D \uBCF4\uAE30'],
  ['\uC0AD\uC81C? \uC0AD\uC81C \uC0AD\uC81C', '\uB77C\uC6B4\uB4DC \uC800\uC7A5 \uC644\uB8CC'],
  ['? \uC0AD\uC81C? \uC0AD\uC81C', '\uC774 \uB77C\uC6B4\uB4DC \uC0AD\uC81C'],
  ['? \uC0AD\uC81C? \uC0AD\uC81C\uC0AD\uC81C.', '\uD640 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'],
  ['{overSign} \uC0AD\uC81C?', '{overSign} \uC624\uBC84\uD30C'],
  ['>?? ?? ??<', '>\uD640\uBCC4 \uACB0\uACFC \uBD84\uD3EC<'],
]);

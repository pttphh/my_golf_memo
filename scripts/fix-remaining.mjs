import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fix(rel, reps) {
  const p = path.join(root, rel);
  let c = fs.readFileSync(p, 'utf8');
  for (const [from, to] of reps) c = c.split(from).join(to);
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK', rel);
}

fix('src/screens/AllRounds.tsx', [
  ['${topClub!.club} ??? ?? ?\uD68C \uBC1C\uC0DD\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.', '${topClub!.club} \uBBF8\uC2A4\uAC00 \uAC00\uC7A5 \uB9CE\uC774 \uBC1C\uC0DD\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.'],
  ['>최근 6라운드 기준</h3>\n              <div className="grid grid-cols-3', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uD3C9\uADE0</h3>\n              <div className="grid grid-cols-3'],
  ['text-center px-2">\n                  <p className="text-[11px] text-gray-500 mb-1">전체 통계</p>\n                  <p className="text-2xl font-extrabold leading-none text-gray-800">{avgScore}',
   'text-center px-2">\n                  <p className="text-[11px] text-gray-500 mb-1">\uD3C9\uADE0 \uD0C0\uC218</p>\n                  <p className="text-2xl font-extrabold leading-none text-gray-800">{avgScore}'],
  ['text-center pl-2">\n                  <p className="text-[11px] text-gray-500 mb-1">전체 통계</p>\n                  <p className="text-2xl font-extrabold leading-none text-blue-500">{avgPutts}',
   'text-center pl-2">\n                  <p className="text-[11px] text-gray-500 mb-1">\uD3C9\uADE0 \uD37C\uD305</p>\n                  <p className="text-2xl font-extrabold leading-none text-blue-500">{avgPutts}'],
  ['\uC2A4\uCF54\uC5B4 \uBD84\uD3EC (\uB77C\uC6B4\uB4DC \uD3C9\uADE0 \uD648 \uC218)', '\uC2A4\uCF54\uC5B4 \uBD84\uD3EC (\uB77C\uC6B4\uB4DC \uD3C9\uADE0 \uD640 \uC218)'],
  ["{ label: '\uBCF4\uAE30', value: avgDouble", "{ label: '\uB354\uBE14', value: avgDouble"],
  ['${avgGir}\uD648`', '${avgGir}\uD640`'],
  ['${avg3Putt}\uD648`', '${avg3Putt}\uD640`'],
  ['${avgDbl}\uD648`', '${avgDbl}\uD640`'],
  ["label: '\uBC84\uB514 \uC774\uD558', value: avgPenalty", "label: '\uBCA8\uD0C0 \uC190\uC2E4', value: avgPenalty"],
  ['>라운드 평균</p>\n                        <p className="text-xs text-gray-500 truncate mt-0.5">{allBestData', '>\uC62C\uD0C0\uC784 \uCD5C\uC800</p>\n                        <p className="text-xs text-gray-500 truncate mt-0.5">{allBestData'],
  ['>최근 6라운드 기준</p>\n                        <p className="text-xs text-gray-500 truncate mt-0.5">{last6BestData', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uCD5C\uC800</p>\n                        <p className="text-xs text-gray-500 truncate mt-0.5">{last6BestData'],
  ['course_name} \uFFFD {', 'course_name} \u00B7 {'],
  ['>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uAE30\uC900</h3>\n              <div className="grid grid-cols-3 divide-x', '>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uD3C9\uADE0</h3>\n              <div className="grid grid-cols-3 divide-x'],
  ['mb-1">\uC804\uCCB4 \uD1B5\uACC4</p>\n                  <p className="text-2xl font-extrabold leading-none text-gray-800">{avgScore}', 'mb-1">\uD3C9\uADE0 \uD0C0\uC218</p>\n                  <p className="text-2xl font-extrabold leading-none text-gray-800">{avgScore}'],
  ['mb-1">\uC804\uCCB4 \uD1B5\uACC4</p>\n                  <p className="text-2xl font-extrabold leading-none text-blue-500">{avgPutts}', 'mb-1">\uD3C9\uADE0 \uD37C\uD305</p>\n                  <p className="text-2xl font-extrabold leading-none text-blue-500">{avgPutts}'],
  ['\uBCA8\uD0C0 \uC190\uC2E4', '\uBC94\uD0C0 \uC190\uC2E4'],
]);

fix('src/screens/RoundSummary.tsx', [
  ['>??? ??</h3>', '>\uB77C\uC6B4\uB4DC \uC0AD\uC81C</h3>'],
  ['? ???? ?????????<br />??? ???? ??? ? ????.', '\uC774 \uB77C\uC6B4\uB4DC\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?<br />\uC0AD\uC81C\uD55C \uB370\uC774\uD130\uB294 \uBCF5\uAD6C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'],
  ['>\n            ??\n          </button>', '>\n            \uCDE8\uC18C\n          </button>'],
  ["{deleting ? '?? ?...' : '??'}", "{deleting ? '\uC0AD\uC81C \uC911...' : '\uC0AD\uC81C'}"],
  ['{round.date} ? {round.time}', '{round.date} \u00B7 {round.time}'],
  ["{ label: '\uBCF4\uAE30', count: scoreDist.double", "{ label: '\uB354\uBE14', count: scoreDist.double"],
  ['label="???? ??? ???"', 'label="\uD398\uC5B4\uC6E8\uC774 \uC548\uCC29\uB960"'],
  ['sub="?? ?? ?"', 'sub="\uADF8\uB9B0 \uC801\uC911 \uD640"'],
  ['label="3??+"', 'label="3\uD37C\uD305+"'],
  ['`${threePuttPlus}?`', '`${threePuttPlus}\uD640`'],
  ['sub="3?? ??"', 'sub="3\uD37C\uD305 \uC774\uC0C1"'],
  ['label="? ??"', 'label="\uCD1D \uD37C\uD305"'],
  ['`${totalPutts}?`', '`${totalPutts}\uAC1C`'],
  ['<TrendingDown size={16} />} label="?? ??" value={`${doubleOrWorse}', '<TrendingDown size={16} />} label="\uB354\uBE14 \uC774\uC0C1" value={`${doubleOrWorse}'],
  ['sub="???? ??"', 'sub="\uB354\uBE14\uBCF4\uAE30 \uC774\uC0C1"'],
  ['<AlertTriangle size={16} />} label="?? ??" value={`${penalties}?`', '<AlertTriangle size={16} />} label="\uBCA8\uD0C0 \uC190\uC2E4" value={`${penalties}\uD0C0`'],
  ['sub="OB×22?2, ????1"', 'sub="OB\u00D72, \uD574\uC800\uB4DC\u00D71"'],
  ['?? ?? ?? ??', '\uBBF8\uC2A4 \uC720\uD615 \uC9D1\uACC4 \uBCF4\uAE30'],
  ['? ? ?? ??', '\uAC01 \uD640 \uAE30\uB85D \uBCF4\uAE30'],
  ["{saving ? '?? ?...' : '??? ?? ??'}", "{saving ? '\uC800\uC7A5 \uC911...' : '\uB77C\uC6B4\uB4DC \uC800\uC7A5 \uC644\uB8CC'}"],
  ['? ??? ??', '\uC774 \uB77C\uC6B4\uB4DC \uC0AD\uC81C'],
  ['            ??\n          </button>', '            \uCDE8\uC18C\n          </button>'],
  ['\uBCA8\uD0C0 \uC190\uC2E4', '\uBC94\uD0C0 \uC190\uC2E4'],
]);

// Fix corrupted penalty sub (any mojibake after OB)
{
  const p = path.join(root, 'src/screens/RoundSummary.tsx');
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/sub="OB[^"]*"/, 'sub="OB\u00D72, \uD574\uC800\uB4DC\u00D71"');
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK RoundSummary penalty sub');
}

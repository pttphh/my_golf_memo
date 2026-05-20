import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NL = '\r\n';

function patch(rel, reps) {
  const p = path.join(root, rel);
  let c = fs.readFileSync(p, 'utf8');
  for (const [from, to] of reps) c = c.split(from).join(to);
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK', rel);
}

patch('src/screens/AllRounds.tsx', [
  [`>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uAE30\uC900</h3>${NL}              <div className="grid grid-cols-3 divide-x divide-gray-100">`, `>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uD3C9\uADE0</h3>${NL}              <div className="grid grid-cols-3 divide-x divide-gray-100">`],
  [`text-center px-2">${NL}                  <p className="text-[11px] text-gray-500 mb-1">\uC804\uCCB4 \uD1B5\uACC4</p>${NL}                  <p className="text-2xl font-extrabold leading-none text-gray-800">{avgScore}`, `text-center px-2">${NL}                  <p className="text-[11px] text-gray-500 mb-1">\uD3C9\uADE0 \uD0C0\uC218</p>${NL}                  <p className="text-2xl font-extrabold leading-none text-gray-800">{avgScore}`],
  [`text-center pl-2">${NL}                  <p className="text-[11px] text-gray-500 mb-1">\uC804\uCCB4 \uD1B5\uACC4</p>${NL}                  <p className="text-2xl font-extrabold leading-none text-blue-500">{avgPutts}`, `text-center pl-2">${NL}                  <p className="text-[11px] text-gray-500 mb-1">\uD3C9\uADE0 \uD37C\uD305</p>${NL}                  <p className="text-2xl font-extrabold leading-none text-blue-500">{avgPutts}`],
  [`>\uB77C\uC6B4\uB4DC \uD3C9\uADE0</p>${NL}                        <p className="text-xs text-gray-500 truncate mt-0.5">{allBestData`, `>\uC62C\uD0C0\uC784 \uCD5C\uC800</p>${NL}                        <p className="text-xs text-gray-500 truncate mt-0.5">{allBestData`],
  [`>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uAE30\uC900</p>${NL}                        <p className="text-xs text-gray-500 truncate mt-0.5">{last6BestData`, `>\uCD5C\uADFC 6\uB77C\uC6B4\uB4DC \uCD5C\uC800</p>${NL}                        <p className="text-xs text-gray-500 truncate mt-0.5">{last6BestData`],
]);

patch('src/screens/RoundSummary.tsx', [
  [`${NL}            ??${NL}          </button>`, `${NL}            \uCDE8\uC18C${NL}          </button>`],
  ['label="???? ???"', 'label="\uD398\uC5B4\uC6E8\uC774 \uC548\uCC29\uB960"'],
  ['label="\uBC94\uB9C8 \uC190\uC2E4"', 'label="\uBC94\uD0C0 \uC190\uC2E4"'],
]);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hole = fs.readFileSync(path.join(root, 'src/screens/HoleRecording.tsx'), 'utf8');
const idx = hole.indexOf('\uC2A4\uCF54\uC5B4 \uBBF8\uBC18\uC0AC'); // unlikely
const i = hole.indexOf('(\uC2A4\uCF54\uC5B4 \uBBF8\uBC18\uC0AC)');
const j = hole.indexOf('\uBBF8\uBC18\uC0AC)'); // 스코어 미반영
const line = hole.slice(hole.lastIndexOf('penaltyTotal', 400000), hole.lastIndexOf('penaltyTotal', 400000) + 200);
const k = line.indexOf('>');
const plus = line.indexOf('+', k);
const word = line.slice(k + 1, plus).trim();
console.log('HoleRecording word:', word, [...word].map(c => c.charCodeAt(0).toString(16)));

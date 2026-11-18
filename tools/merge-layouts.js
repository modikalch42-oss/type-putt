// Merges layout batches from parallel tools/layouts.js runs into tools/layouts.json.
const fs = require('fs'), out = {};
for (const f of process.argv.slice(2)) Object.assign(out, JSON.parse(fs.readFileSync(f, 'utf8')));
fs.writeFileSync(__dirname + '/layouts.json', JSON.stringify(out));
console.log('merged', Object.keys(out).length, 'greens; missing:', Object.values(out).filter(v => !v).length);

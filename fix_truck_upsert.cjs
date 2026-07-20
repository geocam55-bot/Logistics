const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /t\.gpsLat,\s*t\.gpsLng\s*\),/g,
  "t.gpsLat,\n                t.gpsLng,\n                t.gpsSpeed,\n                t.gpsIdlingMins\n              ),"
);

fs.writeFileSync('server.ts', code);
console.log("Fixed trucks upsert serialize params");

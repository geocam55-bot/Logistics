const fs = require('fs');

function fixFile(file) {
  let code = fs.readFileSync(file, 'utf8');

  // serialize signature
  code = code.replace(
    /gpsDeviceId\?: string,\s*gpsDeviceName\?: string,/g,
    "gpsDeviceId?: string,\n  gpsSerialNumber?: string,\n  gpsDeviceName?: string,"
  );

  // serialize generation
  code = code.replace(
    /if \(gpsDeviceId\) \{\s*res \+= \` \|\|gpsDeviceId:\$\{encodeURIComponent\(gpsDeviceId\)\}\`;\s*\}/g,
    "if (gpsDeviceId) {\n    res += \` ||gpsDeviceId:\${encodeURIComponent(gpsDeviceId)}\`;\n  }\n  if (gpsSerialNumber) {\n    res += \` ||gpsSerialNumber:\${encodeURIComponent(gpsSerialNumber)}\`;\n  }"
  );

  // deserialize declaration
  code = code.replace(
    /let gpsDeviceId: string \| undefined;\s*let gpsDeviceName: string \| undefined;/g,
    "let gpsDeviceId: string | undefined;\n  let gpsSerialNumber: string | undefined;\n  let gpsDeviceName: string | undefined;"
  );

  // deserialize parsing
  const newParsing = `const gpsDeviceIdMatch = type.match(/\\|\\|gpsDeviceId:([^\\s|]+)/);
  if (gpsDeviceIdMatch) {
    gpsDeviceId = decodeURIComponent(gpsDeviceIdMatch[1]);
    cleanType = cleanType.replace(/\\|\\|gpsDeviceId:[^\\s|]+/, "");
  }

  const gpsSerialNumberMatch = type.match(/\\|\\|gpsSerialNumber:([^\\s|]+)/);
  if (gpsSerialNumberMatch) {
    gpsSerialNumber = decodeURIComponent(gpsSerialNumberMatch[1]);
    cleanType = cleanType.replace(/\\|\\|gpsSerialNumber:[^\\s|]+/, "");
  }`;
  
  code = code.replace(
    /const gpsDeviceIdMatch = type\.match\(\/\\\|\\\|gpsDeviceId:\(\[\^\\s\|\]\+\)\/\);\s*if \(gpsDeviceIdMatch\) \{\s*gpsDeviceId = decodeURIComponent\(gpsDeviceIdMatch\[1\]\);\s*cleanType = cleanType\.replace\(\/\\\|\\\|gpsDeviceId:\[\^\\s\|\]\+\/,\s*""\);\s*\}/g,
    newParsing
  );

  // deserialize returning
  code = code.replace(
    /gpsDeviceId: gpsDeviceId \|\| '',\s*gpsDeviceName: gpsDeviceName \|\| '',/g,
    "gpsDeviceId: gpsDeviceId || '',\n    gpsSerialNumber: gpsSerialNumber || '',\n    gpsDeviceName: gpsDeviceName || '',"
  );

  fs.writeFileSync(file, code);
}

fixFile('server.ts');
fixFile('src/lib/supabaseClient.ts');

// Also update server.ts trucksToUpsert map
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  /t\.gpsDeviceId,\s*t\.gpsDeviceName,/g,
  "t.gpsDeviceId,\n                t.gpsSerialNumber,\n                t.gpsDeviceName,"
);
fs.writeFileSync('server.ts', serverCode);

console.log("Fixed gpsSerialNumber in serialization");

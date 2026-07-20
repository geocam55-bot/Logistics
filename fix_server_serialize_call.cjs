const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /truck\.gpsDeviceId,\s*truck\.gpsDeviceName,\s*truck\.gpsSimIccid,/g,
  "truck.gpsDeviceId,\n            truck.gpsSerialNumber,\n            truck.gpsDeviceName,\n            truck.gpsSimIccid,"
);

fs.writeFileSync('server.ts', code);
console.log("Fixed serializeToType call in server.ts");

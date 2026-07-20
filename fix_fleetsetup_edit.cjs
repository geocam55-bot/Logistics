const fs = require('fs');

let code = fs.readFileSync('src/components/FleetSetup.tsx', 'utf8');

const regex = /const payload: Truck = \{\s*id: truckId,\s*name: truckName\.trim\(\),/m;
const match = code.match(regex);
if (match) {
  const replacement = `const existingTruck = trucks.find(t => t.id === truckId);
    
    const payload: Truck = {
      ...(existingTruck || {}),
      id: truckId,
      name: truckName.trim(),`;
      
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/FleetSetup.tsx', code);
  console.log("Fixed FleetSetup.tsx");
} else {
  console.log("Could not find payload creation");
}

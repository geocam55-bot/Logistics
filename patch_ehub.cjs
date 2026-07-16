const fs = require('fs');
let code = fs.readFileSync('src/components/EnterpriseHub.tsx', 'utf8');

// 1. Add defaultView to props
code = code.replace(
  'onAddOrUpdateDelivery?: (d: DeliveryRecord) => void;\n}',
  'onAddOrUpdateDelivery?: (d: DeliveryRecord) => void;\n  defaultView?: string;\n}'
);

// 2. Destructure defaultView
code = code.replace(
  '({ deliveries, branches, trucks, users, currentUser, onAddOrUpdateDelivery }: EnterpriseHubProps) => {',
  '({ deliveries, branches, trucks, users, currentUser, onAddOrUpdateDelivery, defaultView = \'customers\' }: EnterpriseHubProps) => {'
);

// 3. Update activeSubTab initial state and add useEffect
code = code.replace(
  "const [activeSubTab, setActiveSubTab] = useState<string>('customers');",
  "const [activeSubTab, setActiveSubTab] = useState<string>(defaultView);\n  useEffect(() => { setActiveSubTab(defaultView); }, [defaultView]);"
);

fs.writeFileSync('src/components/EnterpriseHub.tsx', code);
console.log('Patched EnterpriseHub');

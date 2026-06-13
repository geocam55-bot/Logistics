import { useState, FormEvent, useEffect } from 'react';
import { Tenant, User } from '../types';
import { TENANTS, INITIAL_USERS, INITIAL_USERS_BOF, INITIAL_USERS_CTC } from '../data';
import { Shield, Key, CheckCircle2, ArrowRight, Mail, Lock, Building2, UserCheck, HelpCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (tenant: Tenant, user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('•••••••••');
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState<'Admin' | 'Dispatcher' | 'Driver'>('Dispatcher');
  const [activeTab, setActiveTab] = useState<'presets' | 'credentials'>('presets');
  const [error, setError] = useState<string | null>(null);

  // Helper: map email to correct Tenant of the workspace
  const determineTenantFromEmail = (enteredEmail: string): Tenant => {
    const norm = enteredEmail.toLowerCase().trim();
    if (
      norm.includes('fundy') || 
      norm.includes('bof') || 
      norm.includes('comeau') || 
      norm.includes('peterson') || 
      norm.includes('robichaud') ||
      norm.includes('gentry') ||
      norm.includes('leah')
    ) {
      return TENANTS[1]; // Bay of Fundy Transport
    } else if (
      norm.includes('cabot') || 
      norm.includes('ctc') || 
      norm.includes('mcdonald') || 
      norm.includes('beaton') || 
      norm.includes('oneil') || 
      norm.includes('chisholm')
    ) {
      return TENANTS[2]; // Cabot Trail Cargo
    } else {
      return TENANTS[0]; // Atlantic Shipping & Logistics (Default)
    }
  };

  // Get active tenant state based on the typed email
  const [detectedTenant, setDetectedTenant] = useState<Tenant>(TENANTS[0]);

  useEffect(() => {
    setDetectedTenant(determineTenantFromEmail(email));
  }, [email]);

  // Fast login action
  const handleQuickLogin = (tenant: Tenant, user: User) => {
    onLoginSuccess(tenant, user);
  };

  // Form submission logic
  const handleFormLogin = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide an enterprise email address.');
      return;
    }

    const resolvedTenant = determineTenantFromEmail(email);
    
    // Check if it's one of our seed preset users by email to load their fully hydrated state
    let matchedUser: User | undefined;
    
    if (resolvedTenant.id === 'bay-of-fundy') {
      matchedUser = INITIAL_USERS_BOF.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    } else if (resolvedTenant.id === 'cabot-trail') {
      matchedUser = INITIAL_USERS_CTC.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    } else {
      matchedUser = INITIAL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    }

    if (matchedUser) {
      onLoginSuccess(resolvedTenant, matchedUser);
    } else {
      // Create a persistent mock session user info
      const calculatedName = customName.trim() || email.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const dynamicUser: User = {
        id: `USR-MOCK-${Math.floor(Math.random() * 900) + 100}`,
        name: calculatedName,
        email: email.trim(),
        role: customRole,
        associatedStoreId: resolvedTenant.id === 'bay-of-fundy' ? 'BOF_MONCTON_DC' : resolvedTenant.id === 'cabot-trail' ? 'CTC_HAWKESBURY_DC' : 'WINDMILL_DC'
      };
      onLoginSuccess(resolvedTenant, dynamicUser);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white" id="login-container">
      {/* Absolute top thin styling bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400" />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-lg mx-auto w-full">
        
        {/* RONA Branding Head */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white px-5 py-2 rounded-2xl shadow-xl transform rotate-[-2deg] mb-3.5 border-2 border-blue-800">
            <span className="font-sans font-black text-3xl tracking-tighter text-blue-800 leading-none">RONA</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Contractor Logistics System</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-Tenant Fleet Routing & Manifest Ledger</p>
        </div>

        {/* Central Card */}
        <div className="w-full bg-slate-800/90 rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden backdrop-blur-md">
          
          {/* Active Tenant Discovery Panel */}
          <div className="p-4 bg-slate-700/50 border-b border-slate-700/60 flex items-center justify-between transition-all">
            <div className="flex items-center space-x-3">
              <span className="text-2xl select-none" id="detected-tenant-badge">{detectedTenant.logoBadge}</span>
              <div>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-none">
                  Determined Workspace Tenant
                </span>
                <span className="text-xs font-black text-slate-100 mt-1 block">
                  {detectedTenant.name}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-800">
              {detectedTenant.code} HUB
            </span>
          </div>

          {/* Form / Quick Tab Selector */}
          <div className="flex border-b border-slate-700/50 text-xs">
            <button
              onClick={() => {
                setActiveTab('presets');
                setError(null);
              }}
              className={`flex-1 py-3 text-center font-bold tracking-wide transition-all ${
                activeTab === 'presets'
                  ? 'border-b-2 border-blue-500 text-blue-400 bg-slate-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              💼 Simulated Accounts
            </button>
            <button
              onClick={() => {
                setActiveTab('credentials');
                setError(null);
              }}
              className={`flex-1 py-3 text-center font-bold tracking-wide transition-all ${
                activeTab === 'credentials'
                  ? 'border-b-2 border-blue-500 text-blue-400 bg-slate-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              🔑 Enterprise Login
            </button>
          </div>

          {/* Card Body */}
          <div className="p-6">
            {error && (
              <div className="mb-4 bg-rose-900/30 border border-rose-800 rounded-lg p-3 text-xs text-rose-300 flex items-start space-x-2">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'presets' ? (
              // PRESET SELECTION WITH TENANT GROUPINGS
              <div className="space-y-4">
                <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                  Select an account preset. The system will automatically determine its associated workspace tenant and load the correct isolated environment database:
                </p>

                {/* Theme presets group */}
                <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                  {TENANTS.map((tenant) => {
                    // Filter matching preset characters
                    const matches = 
                      tenant.id === 'bay-of-fundy' ? INITIAL_USERS_BOF :
                      tenant.id === 'cabot-trail' ? INITIAL_USERS_CTC :
                      INITIAL_USERS;

                    // Filter only key demo drivers & roles to make list tighter
                    const demoUsers = matches.filter(u => ['Admin', 'Dispatcher', 'Driver'].includes(u.role)).slice(0, 3);

                    return (
                      <div key={tenant.id} className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">
                          <span>{tenant.logoBadge} {tenant.name}</span>
                          <span className="text-slate-600">({tenant.code})</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {demoUsers.map((user) => {
                            const badgeColor = 
                              user.role === 'Admin' ? 'bg-red-950/80 text-red-300 border-red-900' :
                              user.role === 'Dispatcher' ? 'bg-amber-950/80 text-amber-300 border-amber-900' :
                              'bg-sky-950/80 text-sky-300 border-sky-900';

                            return (
                              <button
                                key={user.id}
                                onClick={() => handleQuickLogin(tenant, user)}
                                className="w-full text-left p-3 rounded-lg border border-slate-700/60 bg-slate-800/40 hover:bg-slate-750 hover:border-slate-600 transition-all flex items-center justify-between group"
                                id={`quick-preset-${user.id}`}
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="h-8 w-8 rounded-full bg-slate-700 font-bold text-slate-300 text-xs flex items-center justify-center border border-slate-600 shadow-inner">
                                    {user.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-xs text-slate-200">{user.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{user.email}</p>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className={`text-[8.5px] font-bold font-mono px-2 py-0.5 rounded border ${badgeColor}`}>
                                    {user.role}
                                  </span>
                                  <div className="h-6 w-6 rounded-md bg-slate-700/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <ArrowRight className="h-3 w-3" />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // ENTERPRISE LOGIN CREDENTIALS
              <form onSubmit={handleFormLogin} className="space-y-4">
                <p className="text-[11px] text-slate-400 leading-relaxed font-normal mb-1">
                  Type any email address below. Based on the domain name or keywords, the application will resolve the proper contractor tenant space automatically:
                </p>

                {/* Email input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                    Enterprise Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. j.peterson@bayoffundy.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Custom Name (Only shown if custom email is entered) */}
                {email.trim() && !INITIAL_USERS.some(u => u.email.toLowerCase() === email.toLowerCase().trim()) &&
                 !INITIAL_USERS_BOF.some(u => u.email.toLowerCase() === email.toLowerCase().trim()) &&
                 !INITIAL_USERS_CTC.some(u => u.email.toLowerCase() === email.toLowerCase().trim()) && (
                  <div className="space-y-3.5 pt-1 border-t border-slate-700/40">
                    <div className="bg-slate-900/50 p-2.5 rounded border border-blue-900/40 text-[10px] text-blue-300 leading-relaxed">
                      💡 <strong>Unregistered Email Detected:</strong> Fill in dynamic profile details below to log in:
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                        Your Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="Robert Cormier"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                        Assigned Portal Role
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Admin', 'Dispatcher', 'Driver'].map((role) => {
                          const isActive = customRole === role;
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setCustomRole(role as any)}
                              className={`py-1.5 text-center text-xs font-bold rounded border transition-all ${
                                isActive
                                  ? 'bg-blue-600 border-blue-500 text-white shadow'
                                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Enterprise Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                    Security Passcode
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-extrabold text-xs transition-colors shadow-md flex items-center justify-center space-x-2"
                >
                  <span>Access {detectedTenant.code} Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Guidance helper */}
          <div className="bg-slate-800 px-6 py-4 border-t border-slate-700/50 text-[10.5px] text-slate-500 leading-relaxed flex items-start space-x-2">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <strong>Tenant Determination Guidelines:</strong> Emails containing <code>fundy</code> or <code>bof</code> route to <strong>Bay of Fundy Transport</strong>. Emails containing <code>cabot</code> or <code>ctc</code> route to <strong>Cabot Trail Cargo</strong>. Any other email defaults to <strong>Atlantic Shipping & Logistics</strong>.
            </div>
          </div>
        </div>

        {/* Secure badge */}
        <div className="mt-6 flex items-center space-x-2 text-[10.5px] text-slate-500">
          <Shield className="h-3.5 w-3.5" />
          <span>Fiducial Multi-Tenant Isolation Key Active (AES-256)</span>
        </div>

      </div>

      {/* Footer bar */}
      <div className="bg-slate-950 text-slate-500 text-center py-4 text-[11px] border-t border-slate-800">
        <p className="font-semibold text-slate-400">RONA Logistics Enterprise SSO Hub</p>
        <p className="mt-0.5 text-slate-600 font-mono">Independent workspaces isolate registers, drivers, vehicles & freight books.</p>
      </div>
    </div>
  );
}

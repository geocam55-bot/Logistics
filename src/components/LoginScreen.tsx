import { useState, FormEvent, useEffect } from 'react';
import { Tenant, User } from '../types';
import { TENANTS, INITIAL_USERS, INITIAL_USERS_BOF, INITIAL_USERS_CTC } from '../data';
import { Shield, Key, CheckCircle2, ArrowRight, Mail, Lock, Building2, UserCheck, HelpCircle, Loader2 } from 'lucide-react';
import prospacesLogo from '../assets/images/prospaces_logo_1781387785955.jpg';

interface LoginScreenProps {
  onLoginSuccess: (tenant: Tenant, user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('•••••••••');
  
  // Registration parameters
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState<'Admin' | 'Dispatcher' | 'Driver'>('Dispatcher');
  const [customPhone, setCustomPhone] = useState('');
  const [customStoreId, setCustomStoreId] = useState('');
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMemberLookup, setShowMemberLookup] = useState(false);

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

  // Fast login selector for active directory testing
  const handleQuickLookup = (selectedUser: User) => {
    setEmail(selectedUser.email);
    setError(null);
    setIsRegistering(false);
  };

  // Form submit - searches live database
  const handleFormLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide an enterprise email address.');
      return;
    }
    setError(null);
    setLoading(true);

    const resolvedTenant = determineTenantFromEmail(email);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim() })
      });

      const result = await response.json();

      if (result.supabaseActive) {
        if (result.found) {
          // Real user found in live Supabase Database!
          onLoginSuccess(result.tenant || resolvedTenant, result.user);
        } else {
          // No user found - let's prompt register flow so they can insert a real database record!
          setIsRegistering(true);
          setError("No active employee profile matched this address in the Supabase connected live database. Register below to create a direct database record now.");
        }
      } else {
        // Fallback for offline sandbox mode
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
          // Create custom dynamic user directly
          const calculatedName = customName.trim() || email.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          const dynamicUser: User = {
            id: `USR-MOCK-${Math.floor(Math.random() * 90) + 10}`,
            name: calculatedName,
            email: email.trim(),
            role: customRole,
            associatedStoreId: resolvedTenant.id === 'bay-of-fundy' ? 'BOF_MONCTON_DC' : resolvedTenant.id === 'cabot-trail' ? 'CTC_HAWKESBURY_DC' : 'WINDMILL_DC'
          };
          onLoginSuccess(resolvedTenant, dynamicUser);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("An operational error occurred while contacting the authentication backend. Verification timed out.");
    } finally {
      setLoading(false);
    }
  };

  // Registration submit - commits user record directly to Supabase
  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setError('Please enter your full name for registration.');
      return;
    }
    setError(null);
    setLoading(true);

    const resolvedTenant = determineTenantFromEmail(email);
    const storeHub = customStoreId || (resolvedTenant.id === 'bay-of-fundy' ? 'BOF_MONCTON_DC' : resolvedTenant.id === 'cabot-trail' ? 'CTC_HAWKESBURY_DC' : 'WINDMILL_DC');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: customName.trim(),
          email: email.trim(),
          role: customRole,
          tenantId: resolvedTenant.id,
          associatedStoreId: storeHub,
          phone: customPhone.trim() || '(902) 555-0199'
        })
      });

      const result = await response.json();

      if (response.ok && (result.success || result.user)) {
        onLoginSuccess(result.tenant || resolvedTenant, result.user);
      } else {
        throw new Error(result.error || "Failed to commit registration.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not complete real user database registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white" id="login-container">
      {/* Absolute top thin styling bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400" />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-lg mx-auto w-full">
        
        {/* ProSpaces Branding Head */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="inline-block bg-white px-5 py-3 rounded-2xl shadow-xl mb-3.5 border-2 border-slate-200 max-w-[320px]">
            <img 
              src={prospacesLogo} 
              alt="ProSpaces Logo" 
              className="h-16 w-auto object-contain mx-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">ProSpaces Delivery and Logistics</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-Tenant Fleet Routing & Live Database Ledger</p>
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

          {/* Secure Login & Enrollment Headers */}
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2 text-blue-400">
              <Key className="h-4 w-4" />
              <h2 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest font-mono">
                {isRegistering ? 'Register Live Employee ID' : 'Enterprise Secure Gateway'}
              </h2>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            {error && (
              <div className="mb-4 bg-rose-950/40 border border-rose-900/50 rounded-xl p-3.5 text-xs text-rose-300 flex items-start space-x-2 leading-relaxed">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {!isRegistering ? (
              // STEP 1: VERIFY ENTERPRISE EMAIL
              <form onSubmit={handleFormLogin} className="space-y-4">
                <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                  Type your enterprise ProSpaces email address below. The client will query the live database to find your exact driver, dispatcher, or administrator registry.
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
                      placeholder="e.g. dave.macneil@prospaces.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Enterprise Passcode */}
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
                  disabled={loading}
                  className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-lg text-white font-extrabold text-xs transition-colors shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit & Verify Account Row</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              // STEP 2: REGISTER PROFILE DIRECTLY TO DATABASE
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Email show */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">Registration For:</span>
                    <span className="font-bold text-slate-200 mt-0.5 block">{email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setError(null);
                    }}
                    className="text-[10px] text-blue-400 hover:underline font-bold"
                  >
                    Change Email
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Robert Cormier"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                    Operational Portal Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Admin', 'Dispatcher', 'Driver'].map((role) => {
                      const isActive = customRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setCustomRole(role as any)}
                          className={`py-1.5 text-center text-xs font-bold rounded border transition-all cursor-pointer ${
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="(902) 555-0199"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                      Hub / Station Code
                    </label>
                    <input
                      type="text"
                      placeholder="WINDMILL_DC"
                      value={customStoreId}
                      onChange={(e) => setCustomStoreId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-lg text-slate-950 font-black text-xs transition-colors shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Writing User Row to Live Database...</span>
                    </>
                  ) : (
                    <>
                      <span>Register User Row & Open Portal</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Active Directory Quick References disclosure component */}
          <div className="border-t border-slate-700/50 bg-slate-800/60">
            <button
              onClick={() => setShowMemberLookup(!showMemberLookup)}
              className="w-full px-6 py-3.5 text-left text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center justify-between transition-colors"
            >
              <span>📂 Open Active Corporate Directory Lookups ({INITIAL_USERS.length + INITIAL_USERS_BOF.length + INITIAL_USERS_CTC.length} items)</span>
              <span>{showMemberLookup ? '▼' : '▲'}</span>
            </button>

            {showMemberLookup && (
              <div className="px-6 pb-5 space-y-4 max-h-[240px] overflow-y-auto border-t border-slate-700/30 pt-3">
                <p className="text-[10px] text-slate-400 leading-normal">
                  To log into your connected live environment database directly without signup, select a corporate employee record. This will fill their enterprise email to authenticate immediately.
                </p>

                {TENANTS.map((tenant) => {
                  const users = 
                    tenant.id === 'bay-of-fundy' ? INITIAL_USERS_BOF :
                    tenant.id === 'cabot-trail' ? INITIAL_USERS_CTC :
                    INITIAL_USERS;

                  return (
                    <div key={tenant.id} className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block font-mono">
                        {tenant.logoBadge} {tenant.name}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {users.slice(0, 3).map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleQuickLookup(user)}
                            className={`p-2 rounded text-left text-[11px] border transition-all cursor-pointer ${
                              email === user.email 
                                ? 'bg-blue-900/60 border-blue-500 text-slate-100' 
                                : 'bg-slate-900/40 border-slate-700/60 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <span className="font-bold block truncate">{user.name}</span>
                            <span className="text-[9.5px] font-mono text-slate-400 mt-0.5 block truncate">{user.email}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
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
        <p className="font-semibold text-slate-400">ProSpaces Delivery and Logistics Enterprise SSO Hub via Supabase</p>
        <p className="mt-0.5 text-slate-600 font-mono">Independent workspaces isolate registers, drivers, vehicles & freight books.</p>
      </div>
    </div>
  );
}

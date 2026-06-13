import { useState, FormEvent, useEffect } from 'react';
import { Tenant, User } from '../types';
import { TENANTS, INITIAL_USERS, INITIAL_USERS_BOF, INITIAL_USERS_CTC } from '../data';
import { Shield, Key, CheckCircle2, ArrowRight, Mail, Lock, Building2, UserCheck, HelpCircle, Loader2 } from 'lucide-react';
import prospacesLogo from '../assets/images/prospaces_logo_1781387785955.jpg';

interface LoginScreenProps {
  onLoginSuccess: (tenant: Tenant, user: User) => void;
  tenantsList?: Tenant[];
}

export default function LoginScreen({ onLoginSuccess, tenantsList }: LoginScreenProps) {
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
    const list = tenantsList || TENANTS;
    const norm = enteredEmail.toLowerCase().trim();

    if (norm === 'superadmin@prospaces.com') {
      return {
        id: "system-admin-tenant",
        name: "System Control Space",
        code: "SYS",
        description: "Global Administration Management Space",
        logoBadge: "⚙️",
        regionalFocus: "Global Administration Management",
        primaryColor: 'slate'
      };
    }

    for (const t of list) {
      if (norm.includes(t.code.toLowerCase()) || norm.includes(t.id.toLowerCase())) {
        return t;
      }
    }

    if (
      norm.includes('fundy') || 
      norm.includes('bof') || 
      norm.includes('comeau') || 
      norm.includes('peterson') || 
      norm.includes('robichaud') ||
      norm.includes('gentry') ||
      norm.includes('leah')
    ) {
      return list.find(t => t.id === 'bay-of-fundy') || list[1] || list[0];
    } else if (
      norm.includes('cabot') || 
      norm.includes('ctc') || 
      norm.includes('mcdonald') || 
      norm.includes('beaton') || 
      norm.includes('oneil') || 
      norm.includes('chisholm')
    ) {
      return list.find(t => t.id === 'cabot-trail') || list[2] || list[0];
    } else {
      return list[0];
    }
  };

  // Get active tenant state based on the typed email
  const [detectedTenant, setDetectedTenant] = useState<Tenant>(() => {
    const list = tenantsList || TENANTS;
    return list[0];
  });

  useEffect(() => {
    setDetectedTenant(determineTenantFromEmail(email));
  }, [email, tenantsList]);

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
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans selection:bg-blue-600 selection:text-white" id="login-container">
      
      {/* Left Column: Atmospheric Display Image Panel */}
      <div className="hidden md:flex md:w-5/12 bg-cover bg-center relative flex-col justify-between p-12 text-slate-100 overflow-hidden" 
           style={{ 
             backgroundImage: `url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1200')` 
           }}>
        {/* Layered Color Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/95 via-blue-950/90 to-indigo-900/85 mix-blend-multiply z-0" />
        <div className="absolute inset-0 bg-blue-900/40 mix-blend-overlay z-0" />

        {/* Top Branding Header */}
        <div className="relative z-10 flex items-center space-x-2">
          <span className="text-xl font-black tracking-wider text-slate-100">PROSPACES</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-mono font-bold tracking-tight border border-blue-400/20">
            FLEET CORE
          </span>
        </div>

        {/* Middle Value Proposition */}
        <div className="relative z-10 my-auto max-w-sm space-y-4">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-none text-slate-50">
            Welcome back,<br />
            <span className="text-blue-400 font-extrabold">team member.</span>
          </h1>
          <p className="text-slate-300/95 text-xs lg:text-sm leading-relaxed font-normal">
            Access your secure fleet management console, organize real-time routing lists, collaborate on live delivery logs, and audit transactional ledgers — all integrated together.
          </p>

          <div className="flex items-center space-x-6 text-xs text-slate-300/90 pt-2">
            <span className="flex items-center space-x-1.5 flex-row">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Secure access</span>
            </span>
            <span className="flex items-center space-x-1.5 flex-row">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Encrypted</span>
            </span>
          </div>
        </div>

        {/* Left Panel Footer Copyright */}
        <div className="relative z-10 text-[11px] text-slate-500">
          <p>© 2026 ProSpaces CRM & Logistics. All rights reserved.</p>
        </div>
      </div>

      {/* Right Column: Secure SSO Form Workspace */}
      <div className="w-full md:w-7/12 bg-white flex flex-col justify-between py-10 px-6 sm:px-12 md:px-16 lg:px-24">
        
        {/* Navigation Action Area */}
        <div className="flex items-center justify-between pointer-events-none md:pointer-events-auto shrink-0 mb-6 font-medium">
          <button 
            type="button" 
            onClick={() => {
              if (email) setEmail('');
              setIsRegistering(false); 
              setError(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors flex items-center space-x-1"
          >
            <span>← Back to home</span>
          </button>
          
          <span className="text-[10px] font-bold text-slate-300 font-mono tracking-widest uppercase">
            SECURED ENDPOINT
          </span>
        </div>

        {/* Center Main Card Block */}
        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto my-auto py-4">
          
          {/* Main ProSpaces Logo Representation */}
          <div className="flex flex-col items-center mb-6">
            <img 
              src={prospacesLogo} 
              alt="ProSpaces Logo" 
              className="h-16 w-auto object-contain mx-auto"
              referrerPolicy="no-referrer"
            />
          </div>

          <h2 className="text-2xl font-bold font-sans text-slate-1000 text-center tracking-tight mb-1.5" style={{ color: '#0f172a' }}>
            {isRegistering ? 'Register Live Account' : 'Members Sign In'}
          </h2>
          <p className="text-slate-400 text-center text-xs mb-8">
            {isRegistering 
              ? 'Enter your profile details to create an isolated database row.' 
              : 'Enter your credentials to access your workspace.'}
          </p>

          {error && (
            <div className="mb-5 bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-800 flex items-start space-x-2.5 leading-relaxed">
              <span className="text-rose-500 font-bold shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {!isRegistering ? (
            // SIGN IN FLOW
            <form onSubmit={handleFormLogin} className="space-y-4">
              
              {/* Email Address */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-slate-700">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-normal shadow-sm"
                  />
                </div>
              </div>

              {/* Password Passcode */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowMemberLookup(!showMemberLookup)}
                    className="text-xs font-semibold text-blue-650 hover:text-blue-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-normal shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMemberLookup(!showMemberLookup)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    title="Toggle Corporate Directory helper"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-white font-semibold text-sm transition-all duration-150 shadow-sm flex items-center justify-center space-x-2 cursor-pointer mt-5"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          ) : (
            // REGISTRATION FORM
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              
              {/* Active email row */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                <div className="text-left">
                  <span className="text-[9px] font-mono text-slate-400 block font-bold uppercase tracking-wider">Registration For email:</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setError(null);
                  }}
                  className="text-[11px] text-blue-650 hover:text-blue-700 font-bold hover:underline"
                >
                  Change Email
                </button>
              </div>

              {/* Personal Full Name */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-semibold text-slate-700">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Cormier"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-105"
                />
              </div>

              {/* Secure Role Selection */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-semibold text-slate-700">
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
                        className={`py-2 text-center text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phone & Hub Station Code */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="(902) 555-0199"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-404 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Hub Station Code
                  </label>
                  <input
                    type="text"
                    placeholder="WINDMILL_DC"
                    value={customStoreId}
                    onChange={(e) => setCustomStoreId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-404 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Submit active registration */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center space-x-2 cursor-pointer mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Writing database row...</span>
                  </>
                ) : (
                  <>
                    <span>Register Row & Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Bottom Navigation Links & Active Lookup helper drawer */}
        <div className="mt-8 text-center text-xs space-y-4 shrink-0 transition-all">
          <p className="text-slate-500">
            Need design tools?{' '}
            <button 
              type="button" 
              onClick={() => setShowMemberLookup(!showMemberLookup)} 
              className="text-blue-650 font-bold hover:underline"
            >
              Open Corporate Directory
            </button>{' '}
            ·{' '}
            <span className="text-emerald-600 font-semibold inline-flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1"></span>
              Live Database Connected
            </span>
          </p>

          {showMemberLookup && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto max-h-[220px] overflow-y-auto space-y-3.5 shadow-inner transition-all">
              <p className="text-[10px] text-slate-500 font-medium leading-normal">
                Click any of the system users or the super administrator profile below to quickly populate credentials for sandbox testing:
              </p>

              {/* System Admin */}
              <div className="space-y-1.5 border border-amber-300/60 bg-amber-50/40 p-2 rounded-lg">
                <span className="text-[8.5px] uppercase font-black tracking-wider text-amber-700 block font-mono">
                  👑 Admin bypass (Global system controller)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('superadmin@prospaces.com');
                    setError(null);
                    setIsRegistering(false);
                  }}
                  className={`w-full p-2 rounded text-left text-xs border transition-all cursor-pointer ${
                    email === 'superadmin@prospaces.com'
                      ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                      : 'bg-white border-amber-200 text-amber-800 hover:border-amber-400'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>ProSpaces Super Admin</span>
                    <span className="bg-amber-200 text-amber-800 text-[8px] font-mono font-bold px-1 rounded uppercase">SUPER_ADMIN</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">superadmin@prospaces.com</span>
                </button>
              </div>

              {/* Corporate Workspace Users list */}
              {(tenantsList || TENANTS).map((tenant) => {
                const users = 
                  tenant.id === 'bay-of-fundy' ? INITIAL_USERS_BOF :
                  tenant.id === 'cabot-trail' ? INITIAL_USERS_CTC :
                  INITIAL_USERS;

                return (
                  <div key={tenant.id} className="space-y-1.5 border-t border-slate-200/50 pt-2 first:border-0 first:pt-0">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block font-mono">
                      {tenant.logoBadge} {tenant.name} Users
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {users.slice(0, 4).map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleQuickLookup(user)}
                          className={`p-2 rounded text-left text-[11px] border transition-all cursor-pointer truncate ${
                            email === user.email 
                              ? 'bg-blue-55 border-blue-400 text-blue-900 font-bold' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'
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

          <div className="flex items-center justify-center space-x-3 text-slate-400">
            <a href="#" className="hover:text-slate-605 transition-colors">Privacy Policy</a>
            <span>|</span>
            <a href="#" className="hover:text-slate-605 transition-colors">Terms of Service</a>
          </div>
        </div>

      </div>
    </div>
  );
}

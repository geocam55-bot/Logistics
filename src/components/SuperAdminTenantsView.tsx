import { useState, FormEvent } from 'react';
import { Tenant } from '../types';
import { Plus, Edit2, Trash2, Check, X, Shield, Landmark, Globe, Sparkles, RefreshCw, AlertTriangle, Database } from 'lucide-react';

interface SuperAdminTenantsViewProps {
  tenants: Tenant[];
  onAddTenant: (t: Tenant) => Promise<void>;
  onUpdateTenant: (t: Tenant) => Promise<void>;
  onDeleteTenant: (id: string) => Promise<void>;
  supabaseStatus: {
    configured: boolean;
    connected: boolean;
    error: string | null;
  } | null;
}

export default function SuperAdminTenantsView({
  tenants,
  onAddTenant,
  onUpdateTenant,
  onDeleteTenant,
  supabaseStatus
}: SuperAdminTenantsViewProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [logoBadge, setLogoBadge] = useState('🏢');
  const [regionalFocus, setRegionalFocus] = useState('');
  const [primaryColor, setPrimaryColor] = useState<'blue' | 'emerald' | 'indigo' | 'slate'>('blue');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const resetForm = () => {
    setId('');
    setName('');
    setCode('');
    setDescription('');
    setLogoBadge('🏢');
    setRegionalFocus('');
    setPrimaryColor('blue');
    setError(null);
    setEditingId(null);
    setIsEditing(false);
  };

  const startEdit = (t: Tenant) => {
    setEditingId(t.id);
    setId(t.id);
    setName(t.name);
    setCode(t.code);
    setDescription(t.description || '');
    setLogoBadge(t.logoBadge || '🏢');
    setRegionalFocus(t.regionalFocus || '');
    setPrimaryColor(t.primaryColor || 'blue');
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic Validations
    if (!id.trim() || !name.trim() || !code.trim() || !logoBadge.trim() || !regionalFocus.trim()) {
      setError('All fields except description are required to construct an active corporate tenant space.');
      return;
    }

    const tenantIdSlug = id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const tenantCodeUpper = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (tenantCodeUpper.length < 2 || tenantCodeUpper.length > 5) {
      setError('Tenant Code must be between 2 and 5 alphanumeric characters.');
      return;
    }

    // Check uniqueness when creating a new tenant
    if (!editingId) {
      if (tenants.some(t => t.id === tenantIdSlug)) {
        setError(`A tenant with the ID "${tenantIdSlug}" already exists. Provide a unique name to generate a discrete ID.`);
        return;
      }
      if (tenants.some(t => t.code === tenantCodeUpper)) {
        setError(`A tenant with the unique short code "${tenantCodeUpper}" already exists.`);
        return;
      }
    }

    setBusy(true);
    try {
      const payload: Tenant = {
        id: editingId || tenantIdSlug,
        name: name.trim(),
        code: tenantCodeUpper,
        description: description.trim(),
        logoBadge: logoBadge.trim(),
        regionalFocus: regionalFocus.trim(),
        primaryColor
      };

      if (editingId) {
        await onUpdateTenant(payload);
        setSuccess(`Successfully updated logistics partner "${payload.name}" in the enterprise ecosystem.`);
      } else {
        await onAddTenant(payload);
        setSuccess(`Successfully synchronized and commissioned brand-new tenant space "${payload.name}"!`);
      }
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while writing tenant details to the storage provider.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (targetId: string, targetName: string) => {
    const confirmation = window.confirm(
      `⚠️ WARNING: Are you absolutely certain you want to decommission tenant "${targetName}"?\n\nThis is a destructive action that will CASCADE-DELETE all stores, registered delivery vehicles, users, active freight boards, and scan records belonging to this workspace permanently.`
    );
    if (!confirmation) return;

    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      await onDeleteTenant(targetId);
      setSuccess(`Decommissioned and deleted "${targetName}" from the enterprise database core.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not complete destruction request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" id="super-admin-view-panel">
      
      {/* Alert Messaging Box */}
      {(error || success) && (
        <div className="animate-fade-in">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-semibold flex items-start space-x-2.5 shadow-sm">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-start space-x-2.5 shadow-sm">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Management Controls and Active Listing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Editor */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <Landmark className="h-4 w-4" />
              </div>
              <h3 className="font-sans font-black text-gray-900 text-sm uppercase tracking-wider">
                {editingId ? 'Modify Workspace Tenant' : 'Register New Tenant Partner'}
              </h3>
            </div>
            {isEditing && (
              <button 
                onClick={resetForm} 
                className="text-xs text-gray-400 hover:text-gray-600 font-mono font-bold flex items-center space-x-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Unique Tenant Domain Identifier */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">
                Unique Domain/Database ID Slug
              </label>
              <input
                type="text"
                required
                disabled={!!editingId}
                placeholder="e.g. maritime-freight-corp"
                value={id}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                  setId(val);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:border-blue-500 outline-none transition-all disabled:bg-slate-100 disabled:text-gray-400"
              />
              <p className="text-[9.5px] text-gray-400 font-mono mt-1">
                System slug used for file names, database keys, and isolations. Alphanumeric and dashes only.
              </p>
            </div>

            {/* Partner Legal Name */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">
                Corporate partner Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maritime Freight Systems Ltd."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Auto-generate tentative ID if not editing
                  if (!editingId) {
                    const slug = e.target.value.toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-');
                    setId(slug);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Short Unique Code */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">
                  Tenant Code (e.g. MFS)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MFS"
                  maxLength={5}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* Logo Badge Icon Emoji */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">
                  Logo Badge Emoji
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 🚛"
                  value={logoBadge}
                  onChange={(e) => setLogoBadge(e.target.value)}
                  className="text-center w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
                <p className="text-[9px] text-slate-400 text-center mt-1">Emoji, maximum 1-2 symbols</p>
              </div>
            </div>

            {/* Regional Focus */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">
                Regional Logistics Focus Space
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">
                  <Globe className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maine Corridor, Bangor & Portland DC Hubs"
                  value={regionalFocus}
                  onChange={(e) => setRegionalFocus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Brand Theme Accent Color selector */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1.5">
                Workspace Brand Accent Color
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'blue', label: 'Classic blue', bg: 'bg-blue-600' },
                  { value: 'emerald', label: 'Emerald Green', bg: 'bg-emerald-600' },
                  { value: 'indigo', label: 'Indigo Tech', bg: 'bg-indigo-600' },
                  { value: 'slate', label: 'Slate Charcoal', bg: 'bg-slate-600' }
                ].map((col) => {
                  const isSelected = primaryColor === col.value;
                  return (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setPrimaryColor(col.value as any)}
                      className={`py-2 rounded-xl text-[10.5px] font-bold border flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-800/15' 
                          : 'border-slate-200 bg-white text-gray-500 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full ${col.bg}`} />
                      <span className="text-[9.5px]">{col.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Client Description */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">
                Partner Description
              </label>
              <textarea
                rows={2}
                placeholder="Briefly state service scope and stores/DC layout of this organization..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Submit Commission Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center space-x-2"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving to Database Core...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>{editingId ? 'Modify Commission' : 'Commission Workspace'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Active Organizations Listing */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-4">
            
            {/* Header section with Supabase sync diagnostics */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-sans font-black text-gray-900 text-sm uppercase tracking-wider">
                  Active Logistical Organizations ({tenants.length})
                </h3>
                <p className="text-[11px] text-gray-500 mt-1">
                  These verified corporate partitions have isolated dispatch databases, freight fleets, and local OCR templates.
                </p>
              </div>

              {/* Secure status pill */}
              <div className={`p-2 rounded-xl text-[10px] font-mono flex items-center space-x-1.5 border leading-none shrink-0 ${
                supabaseStatus?.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <Database className="h-3.5 w-3.5 text-current" />
                <span>{supabaseStatus?.connected ? 'Live Database Active' : 'Local Sandbox Store'}</span>
              </div>
            </div>

            {/* Tenant Card List */}
            <div className="space-y-3.5" id="admin-tenants-list">
              {tenants.map((t) => {
                const colorBadgeBg = 
                  t.primaryColor === 'blue' ? 'bg-blue-100 text-blue-900 border-blue-200' :
                  t.primaryColor === 'emerald' ? 'bg-emerald-100 text-emerald-900 border-emerald-200' :
                  t.primaryColor === 'indigo' ? 'bg-indigo-100 text-indigo-900 border-indigo-200' :
                  'bg-slate-100 text-slate-900 border-slate-200';

                const borderAccent = 
                  t.primaryColor === 'blue' ? 'group-hover:border-blue-400' :
                  t.primaryColor === 'emerald' ? 'group-hover:border-emerald-400' :
                  t.primaryColor === 'indigo' ? 'group-hover:border-indigo-400' :
                  'group-hover:border-slate-400';

                return (
                  <div 
                    key={t.id}
                    className={`group bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl p-4 transition-all duration-200 hover:shadow-sm hover:translate-y-[-0.5px] border-l-4 border-l-slate-350 ${borderAccent}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Name and context badge */}
                      <div className="flex items-start space-x-3">
                        <span className="text-3xl select-none shrink-0 mt-0.5">{t.logoBadge || '🏢'}</span>
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <h4 className="font-sans font-black text-gray-900 text-sm leading-tight">
                              {t.name}
                            </h4>
                            <span className="bg-slate-200 text-gray-800 text-[9.5px] font-black px-2 py-0.5 rounded font-mono border border-slate-300">
                              {t.code}
                            </span>
                            <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${colorBadgeBg}`}>
                              {t.primaryColor || 'blue'} theme
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 leading-normal">
                            {t.description || 'No detailed corporate description available.'}
                          </p>
                          <div className="flex items-center space-x-1 text-[10.5px] text-gray-500 font-medium">
                            <Globe className="h-3.5 w-3.5 text-gray-400" />
                            <span>Region: <strong>{t.regionalFocus || 'Unassigned'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Modification Actions */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => startEdit(t)}
                          title="Edit corporate partner variables"
                          className="p-1 px-2.5 rounded bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all flex items-center space-x-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        
                        {/* Protect the system-admin-tenant from arbitrary deletes */}
                        {t.id !== 'system-admin-tenant' && (
                          <button
                            onClick={() => handleDelete(t.id, t.name)}
                            title="Decommission this organization workspace"
                            className="p-1 px-2.5 rounded bg-rose-50 border border-rose-100/50 hover:bg-rose-100/80 hover:border-rose-200 text-rose-700 font-bold text-xs transition-all flex items-center space-x-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="hidden sm:inline">Declaim</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata indicators */}
                    <div className="mt-3 pt-3 border-t border-slate-250/20 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 font-mono">
                      <span>Unique ID: <strong className="text-slate-600">{t.id}</strong></span>
                      <span>&bull;</span>
                      <span>Standard Scope: Isolated Registry Nodes</span>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

          {/* Guideline Informational Panel */}
          <div className="bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl p-5 space-y-3 shadow-md">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <Shield className="h-4 w-4" />
              <h4 className="font-sans font-black text-xs uppercase tracking-widest font-mono">Super Admin Ecosystem Rules</h4>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400 font-medium">
              <li>Each Tenant is completely isolated. Dispatches, drivers, and fleet inventories do not leak or mix.</li>
              <li>Adding a Tenant dynamically updates the gateway login auto-detection algorithms immediately.</li>
              <li>Changing tenant primary color automatically switches client layouts, buttons, and panels to match brand guides (Corporate Blue, Forest Emerald, Indigo Tech, Charcoal Slate).</li>
              <li>Only the root <strong className="text-slate-200">SUPER_ADMIN</strong> accounts may enter this command view.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}

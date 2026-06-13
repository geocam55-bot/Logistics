import React, { useState } from 'react';
import { User, UserRole, Branch } from '../types';
import { Users, UserPlus, Edit2, Trash2, Shield, Info, CheckCircle, Mail, Phone, Building } from 'lucide-react';

interface UsersSetupProps {
  users: User[];
  branches: Branch[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

export default function UsersSetup({
  users,
  branches,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}: UsersSetupProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form Inputs
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('User');
  const [userPhone, setUserPhone] = useState('');
  const [associatedStoreId, setAssociatedStoreId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const ROLES: UserRole[] = ['Driver', 'Dispatcher', 'User', 'Admin'];

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Dispatcher':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Driver':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'User':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleStartAdd = () => {
    setUserId(`USR-${Math.floor(1000 + Math.random() * 9000)}`);
    setUserName('');
    setUserEmail('');
    setUserRole('User');
    setUserPhone('');
    setAssociatedStoreId(branches[0]?.id || '');
    setIsAdding(true);
    setEditingUserId(null);
  };

  const handleStartEdit = (user: User) => {
    setUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserRole(user.role);
    setUserPhone(user.phone || '');
    setAssociatedStoreId(user.associatedStoreId || '');
    setEditingUserId(user.id);
    setIsAdding(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) {
      alert('Please fill in both the User name and email address.');
      return;
    }

    const payload: User = {
      id: userId,
      name: userName.trim(),
      email: userEmail.trim(),
      role: userRole,
      phone: userPhone.trim() || undefined,
      associatedStoreId: associatedStoreId || undefined
    };

    if (editingUserId) {
      onUpdateUser(payload);
      setEditingUserId(null);
      showFeedback('User profile updated successfully.');
    } else {
      // Check if ID unique
      if (users.some(u => u.id === userId)) {
        payload.id = `USR-${Math.floor(10000 + Math.random() * 89999)}`;
      }
      onAddUser(payload);
      setIsAdding(false);
      showFeedback('New user credential provisioned successfully.');
    }

    // Reset Form
    setUserName('');
    setUserEmail('');
    setUserPhone('');
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently disable and delete user account: "${name}"?`)) {
      onDeleteUser(id);
      showFeedback('User database record decommissioned.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="users-setup-view">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h4 className="font-sans font-bold text-gray-900 tracking-tight text-xl">User & Operator Accounts Registry</h4>
          <p className="text-xs text-gray-500">
            Provision roles, manage regional dispatcher log profiles, and authorize drivers for fleet tracking
          </p>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center space-x-2 shadow-sm">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Add/Edit form */}
        <div className="lg:col-span-4 space-y-4">
          {(!isAdding && !editingUserId) ? (
            <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm text-center space-y-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h5 className="text-sm font-bold text-gray-900">Provision User Account</h5>
                <p className="text-xs text-gray-500 mt-1">
                  Create secure system roles to assign delivery routes or give supervisory authorization rules.
                </p>
              </div>
              <button
                onClick={handleStartAdd}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add User Account</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider font-mono flex items-center">
                  <UserPlus className="h-4 w-4 mr-1 text-blue-600" />
                  {editingUserId ? 'Edit Account' : 'Provision User'}
                </h5>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setEditingUserId(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">User Identifier</label>
                  <input
                    type="text"
                    value={userId}
                    disabled
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded text-xs font-mono text-gray-500"
                  />
                  <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">Unique server-assigned user ID</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David MacNeil"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Corporate Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@prospaces.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Access Role</label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as UserRole)}
                      className="w-full border bg-white border-slate-200 px-2.5 py-1.5 rounded text-xs text-gray-800"
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="(902) 555-xxxx"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="w-full border bg-white border-slate-200 px-2.5 py-1.5 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Primary Linked ProSpaces Branch</label>
                  <select
                    value={associatedStoreId}
                    onChange={(e) => setAssociatedStoreId(e.target.value)}
                    className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800"
                  >
                    <option value="">-- No Store Association --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg text-center font-sans tracking-tight"
                >
                  {editingUserId ? 'Save Profile' : 'Authorize User'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setEditingUserId(null); }}
                  className="px-3 bg-slate-100 hover:bg-slate-200 text-gray-600 text-xs font-medium rounded-lg"
                >
                  Dismiss
                </button>
              </div>
            </form>
          )}

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] text-gray-500 space-y-2">
            <p className="font-semibold flex items-center text-gray-800 text-xs">
              <Info className="h-3.5 w-3.5 mr-1 text-blue-500" /> Account Roles Matrix
            </p>
            <p>
              <strong>Driver:</strong> Operates physical vehicles. Logged runs.
              <br />
              <strong>Dispatcher:</strong> Directs queues and prints barcodes.
              <br />
              <strong>Admin:</strong> Total control of registries and store boundaries.
              <br />
              <strong>User:</strong> Customer support and generic order viewing.
            </p>
          </div>
        </div>

        {/* Right column: User grid list */}
        <div className="lg:col-span-8 bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-sans font-bold text-gray-900 text-base">Registered System Users Roster</h4>
                <p className="text-xs text-gray-500 font-medium">Currently authorizing {users.length} registered profiles in this zone</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {users.map(user => {
                const matchedBranch = branches.find(b => b.id === user.associatedStoreId);

                return (
                  <div
                    key={user.id}
                    className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-all bg-white relative flex flex-col justify-between shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h5 className="font-sans font-bold text-gray-900 text-sm">{user.name}</h5>
                          <span className="text-[10px] text-gray-400 font-mono font-medium block">
                            ID: {user.id}
                          </span>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${getRoleBadgeStyle(user.role)}`}>
                          {user.role}
                        </span>
                      </div>

                      <div className="border-t border-slate-100/60 pt-2.5 space-y-1 text-xs text-gray-500">
                        <div className="flex items-center space-x-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {matchedBranch ? matchedBranch.name.replace(' ProSpaces', '') : 'No Store Association'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-1 border-t border-slate-100/60 mt-3 pt-2">
                      <button
                        onClick={() => handleStartEdit(user)}
                        className="p-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                        title="Edit User profile"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        className="p-1.5 hover:bg-red-50 border border-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors"
                        title="Disable Account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 bg-white">
            <span className="flex items-center">
              <Shield className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Active Local User Session Authorization
            </span>
            <span>Active regional crew: <strong>{users.length}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

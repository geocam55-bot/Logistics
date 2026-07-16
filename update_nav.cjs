const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

const navStart = '<div className="hidden lg:block border-t border-slate-100 bg-slate-50/70 py-1.5 select-none" id="prospaces-nav-unified-sticky">';
const navEnd = '</div>\n          </div>\n        </div>';

const startIdx = app.indexOf(navStart);
const endIdx = app.indexOf(navEnd, startIdx);

const newNav = `<div className="hidden lg:block border-t border-slate-100 bg-slate-50/70 py-1.5 select-none" id="prospaces-nav-unified-sticky">
          <div className="max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-2 lg:space-x-4">
              
              {/* Group 1: Dispatcher Space */}
              <div className="group relative">
                <button className="flex items-center space-x-2 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>Dispatcher Space</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:rotate-180 transition-transform" />
                </button>
                <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl p-1.5 min-w-[200px] z-[100] animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                      activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }\`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>HQ Dashboard</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('live-dashboard')}
                    className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                      activeTab === 'live-dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }\`}
                  >
                    <Activity className="h-4 w-4 text-[#FF5A1F]" />
                    <span>Live Monitor</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('queue')}
                    className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                      activeTab === 'queue' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }\`}
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span>Freight Board</span>
                  </button>
                </div>
              </div>

              {/* Group 2: Picker Space */}
              {['Admin', 'Dispatcher', 'Picker'].includes(currentUser?.role || '') && (
                <div className="group relative">
                  <button className="flex items-center space-x-2 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Picker Space</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:rotate-180 transition-transform" />
                  </button>
                  <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl p-1.5 min-w-[200px] z-[100] animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => setActiveTab('scanner')}
                      className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                        activeTab === 'scanner' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }\`}
                    >
                      <Scan className="h-4 w-4 text-amber-600" />
                      <span>Loading Scanner</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Group 3: Driver Space */}
              {['Admin', 'Dispatcher', 'Driver'].includes(currentUser?.role || '') && (
                <div className="group relative">
                  <button className="flex items-center space-x-2 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Driver Space</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:rotate-180 transition-transform" />
                  </button>
                  <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl p-1.5 min-w-[200px] z-[100] animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => setActiveTab('epod')}
                      className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                        activeTab === 'epod' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }\`}
                    >
                      <TruckIcon className="h-4 w-4 text-emerald-600" />
                      <span>Mobile EPOD</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('inspections')}
                      className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                        activeTab === 'inspections' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }\`}
                    >
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span>Vehicle Inspections</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('fuel')}
                      className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                        activeTab === 'fuel' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }\`}
                    >
                      <Activity className="h-4 w-4 text-rose-500" />
                      <span>Fuel Tracker</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Group 4: Admin Space */}
              {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
                <div className="group relative">
                  <button className="flex items-center space-x-2 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                    <span>Admin Space</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:rotate-180 transition-transform" />
                  </button>
                  <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl p-1.5 min-w-[200px] z-[100] animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => setActiveTab('enterprise-hub')}
                      className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                        activeTab === 'enterprise-hub' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }\`}
                    >
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span>Enterprise Hub</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('document-import')}
                      className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                        activeTab === 'document-import' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }\`}
                    >
                      <FileDown className="h-4 w-4" />
                      <span>Doc Import</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('stores')}
                      className={\`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center space-x-2.5 transition-all cursor-pointer \${
                        ['stores', 'trucks', 'gps', 'users', 'architecture'].includes(activeTab) ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }\`}
                    >
                      <Settings className="h-4 w-4" />
                      <span>System Config</span>
                    </button>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>`;

app = app.substring(0, startIdx) + newNav + app.substring(endIdx + navEnd.length);
fs.writeFileSync('src/App.tsx', app);
console.log('Successfully updated App.tsx nav to use dropdowns');

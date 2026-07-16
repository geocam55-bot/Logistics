const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

const navStart = '<div className="space-y-1">';
const navEnd = '</div>\n                  </div>\n                </>\n              )}';

const startIdx = app.indexOf(navStart, app.indexOf('isMobileNavOpen'));
if (startIdx === -1) {
  console.log('Start index not found');
  process.exit(1);
}
// Find the closing div of this block.
const endIdx = app.indexOf(navEnd, startIdx);
if (endIdx === -1) {
  console.log('End index not found');
  process.exit(1);
}

const newNav = `<div className="space-y-1">
                      <div className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans mt-3 mb-1 px-2 border-b border-slate-100 pb-1">Dispatcher Space</div>
                      <button
                        onClick={() => {
                          setActiveTab('dashboard');
                          setIsMobileNavOpen(false);
                        }}
                        className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center space-x-2.5 transition-all cursor-pointer \${
                          activeTab === 'dashboard'
                            ? 'bg-blue-800 text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-50'
                        }\`}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>HQ Dashboard</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('live-dashboard');
                          setIsMobileNavOpen(false);
                        }}
                        className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center space-x-2.5 transition-all cursor-pointer \${
                          activeTab === 'live-dashboard'
                            ? 'bg-blue-800 text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-50'
                        }\`}
                      >
                        <Activity className="h-4 w-4 text-[#FF5A1F] animate-pulse" />
                        <span>Live Monitor</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('queue');
                          setIsMobileNavOpen(false);
                        }}
                        className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-between transition-all cursor-pointer \${
                          activeTab === 'queue'
                            ? 'bg-blue-800 text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-50'
                        }\`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <ClipboardList className="h-4 w-4" />
                          <span>Freight Board</span>
                        </div>
                        {deliveries.length > 0 && (
                          <span className={\`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full \${activeTab === 'queue' ? 'bg-white text-blue-900 font-mono' : 'bg-slate-100 text-slate-600 font-mono'}\`}>
                            {deliveries.length}
                          </span>
                        )}
                      </button>

                      <div className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans mt-3 mb-1 px-2 border-b border-slate-100 pb-1">Picker Space</div>
                      {['Admin', 'Dispatcher', 'Picker'].includes(currentUser?.role || '') && (
                        <button
                          onClick={() => {
                            setActiveTab('scanner');
                            setIsMobileNavOpen(false);
                          }}
                          className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center space-x-2.5 transition-all cursor-pointer \${
                            activeTab === 'scanner'
                              ? 'bg-blue-800 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-50'
                          }\`}
                        >
                          <Scan className="h-4 w-4 text-amber-600" />
                          <span>Loading Scanner</span>
                        </button>
                      )}

                      <div className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans mt-3 mb-1 px-2 border-b border-slate-100 pb-1">Driver Space</div>
                      {['Admin', 'Dispatcher', 'Driver'].includes(currentUser?.role || '') && (
                        <button
                          onClick={() => {
                            setActiveTab('scanner');
                            setIsMobileNavOpen(false);
                          }}
                          className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center space-x-2.5 transition-all cursor-pointer \${
                            activeTab === 'scanner'
                              ? 'bg-blue-800 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-50'
                          }\`}
                        >
                          <TruckIcon className="h-4 w-4 text-emerald-600" />
                          <span>Mobile EPOD</span>
                        </button>
                      )}

                      <div className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans mt-3 mb-1 px-2 border-b border-slate-100 pb-1">Admin Space</div>
                      {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
                        <button
                          onClick={() => {
                            setActiveTab('enterprise-hub');
                            setIsMobileNavOpen(false);
                          }}
                          className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center space-x-2.5 transition-all cursor-pointer \${
                            activeTab === 'enterprise-hub'
                              ? 'bg-blue-800 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-50'
                          }\`}
                        >
                          <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
                          <span>Enterprise Hub</span>
                        </button>
                      )}

                      {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
                        <button
                          onClick={() => {
                            setActiveTab('document-import');
                            setIsMobileNavOpen(false);
                          }}
                          className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center space-x-2.5 transition-all cursor-pointer \${
                            activeTab === 'document-import'
                              ? 'bg-blue-800 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-50'
                          }\`}
                        >
                          <FileDown className="h-4 w-4" />
                          <span>Doc Import</span>
                        </button>
                      )}

                      {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
                        <button
                          onClick={() => {
                            setActiveTab('stores');
                            setIsMobileNavOpen(false);
                          }}
                          className={\`w-full py-2 px-3 text-xs font-bold rounded-xl flex items-center space-x-2.5 transition-all cursor-pointer \${
                            ['stores', 'trucks', 'gps', 'users', 'architecture'].includes(activeTab)
                              ? 'bg-blue-800 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-50'
                          }\`}
                        >
                          <Settings className="h-4 w-4" />
                          <span>System Config</span>
                        </button>
                      )}
                    `;

app = app.substring(0, startIdx) + newNav + app.substring(endIdx);
fs.writeFileSync('src/App.tsx', app);
console.log('Successfully updated App.tsx mobile nav');

const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Update the nav bar
const navStart = '<div className="hidden lg:block border-t border-slate-100 bg-slate-50/70 py-1.5 select-none" id="prospaces-nav-unified-sticky">';
const navEnd = '</div>\n          </div>\n        </div>';

const startIdx = app.indexOf(navStart);
const endIdx = app.indexOf(navEnd, startIdx);

const newNav = `<div className="hidden lg:block border-t border-slate-100 bg-slate-50/70 py-1.5 select-none" id="prospaces-nav-unified-sticky">
          <div className="max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:divide-x lg:divide-slate-200/80">
              
              {/* Group 1: Dispatcher Space */}
              <div className="lg:col-span-4 flex flex-col space-y-1">
                <div className="flex items-center space-x-1 px-1">
                  <span className="w-1 h-1 rounded-full bg-blue-600"></span>
                  <span className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans">
                    Dispatcher Space
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={\`flex-1 min-w-[70px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                      activeTab === 'dashboard' 
                        ? theme.activeBtn
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                    }\`}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>HQ</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('live-dashboard')}
                    className={\`flex-1 min-w-[70px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                      activeTab === 'live-dashboard' 
                        ? theme.activeBtn
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                    }\`}
                  >
                    <Activity className="h-3.5 w-3.5 text-[#FF5A1F] animate-pulse" />
                    <span>Live</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('queue')}
                    className={\`flex-1 min-w-[80px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                      activeTab === 'queue' 
                        ? theme.activeBtn
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                    }\`}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>Freight Board</span>
                  </button>
                </div>
              </div>

              {/* Group 2: Picker Space */}
              <div className="lg:col-span-2 lg:pl-3 flex flex-col space-y-1">
                <div className="flex items-center space-x-1 px-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                  <span className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans">
                    Picker Space
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['Admin', 'Dispatcher', 'Picker'].includes(currentUser?.role || '') && (
                    <button
                      onClick={() => setActiveTab('scanner')}
                      className={\`flex-1 w-full py-1.5 px-2.5 text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition-all whitespace-nowrap cursor-pointer \${
                        activeTab === 'scanner' 
                          ? theme.activeBtn
                          : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                      }\`}
                    >
                      <Scan className="h-3.5 w-3.5 text-amber-600" />
                      <span>Scanner</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Group 3: Driver Space */}
              <div className="lg:col-span-3 lg:pl-3 flex flex-col space-y-1">
                <div className="flex items-center space-x-1 px-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                  <span className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans">
                    Driver Space
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['Admin', 'Dispatcher', 'Driver'].includes(currentUser?.role || '') && (
                    <>
                      <button
                        onClick={() => setActiveTab('epod')}
                        className={\`flex-1 min-w-[70px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                          activeTab === 'epod' 
                            ? theme.activeBtn
                            : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                        }\`}
                      >
                        <TruckIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <span>EPOD</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('inspections')}
                        className={\`flex-1 min-w-[70px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                          activeTab === 'inspections' 
                            ? theme.activeBtn
                            : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                        }\`}
                      >
                        <Shield className="h-3.5 w-3.5 text-blue-500" />
                        <span>Inspect</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('fuel')}
                        className={\`flex-1 min-w-[60px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                          activeTab === 'fuel' 
                            ? theme.activeBtn
                            : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                        }\`}
                      >
                        <Activity className="h-3.5 w-3.5 text-rose-500" />
                        <span>Fuel</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Group 4: Admin Space */}
              <div className="lg:col-span-3 lg:pl-3 flex flex-col space-y-1">
                <div className="flex items-center space-x-1 px-1">
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-sans">
                    Admin Space
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
                    <button
                      onClick={() => setActiveTab('enterprise-hub')}
                      className={\`flex-1 min-w-[80px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                        activeTab === 'enterprise-hub' 
                          ? theme.activeBtn
                          : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                      }\`}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
                      <span>Enterprise</span>
                    </button>
                  )}
                  {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
                    <button
                      onClick={() => setActiveTab('document-import')}
                      className={\`flex-1 min-w-[70px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                        activeTab === 'document-import' 
                          ? theme.activeBtn
                          : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                      }\`}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      <span>Docs</span>
                    </button>
                  )}
                  {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
                    <button
                      onClick={() => setActiveTab('stores')}
                      className={\`flex-1 min-w-[70px] py-1.5 px-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer \${
                        ['stores', 'trucks', 'gps', 'users', 'architecture'].includes(activeTab)
                          ? theme.activeBtn
                          : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/50 hover:shadow-xs'
                      }\`}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Setup</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>`;

app = app.substring(0, startIdx) + newNav + app.substring(endIdx + navEnd.length);

// 2. Update rendering block
const renderStart = "{activeTab === 'enterprise-hub' && (";
const renderEnd = "          )}";

const renderStartIdx = app.indexOf(renderStart);
const renderEndIdx = app.indexOf(renderEnd, renderStartIdx);

const newRender = `{['enterprise-hub', 'epod', 'inspections', 'fuel', 'safety', 'compliance', 'maintenance', 'routes'].includes(activeTab) && (
            <EnterpriseHub 
              deliveries={deliveries}
              branches={branches}
              trucks={trucks}
              users={users}
              currentUser={currentUser}
              onAddOrUpdateDelivery={handleAddOrUpdateDelivery}
              defaultView={
                activeTab === 'epod' ? 'pod' :
                activeTab === 'inspections' ? 'inspections' :
                activeTab === 'fuel' ? 'fuel' :
                activeTab === 'enterprise-hub' ? 'customers' :
                activeTab
              }
            />
          )}`;

app = app.substring(0, renderStartIdx) + newRender + app.substring(renderEndIdx + renderEnd.length);

fs.writeFileSync('src/App.tsx', app);
console.log('Patched App.tsx');

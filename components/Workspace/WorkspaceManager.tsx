
import React, { useState, useEffect } from 'react';
import { Responsive, Layout } from 'react-grid-layout';
// @ts-ignore - WidthProvider is a named export of react-grid-layout but may not be recognized in all TypeScript configurations
import { WidthProvider } from 'react-grid-layout';
import { RefreshCw, Layout as LayoutIcon, Lock, Unlock, Minimize2 } from '../icons';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface PanelContext {
  isEditMode: boolean;
  isFocused: boolean;
  isCollapsed: boolean;
  onToggleFocus: () => void;
  onToggleCollapse: () => void;
}

interface WorkspacePanel {
  id: string;
  title: string;
  render: (ctx: PanelContext) => React.ReactNode;
  minW?: number;
  minH?: number;
}

interface WorkspaceManagerProps {
  screenId: string;
  panels: WorkspacePanel[];
  /** FIX: Corrected defaultLayouts type. Layout is already an array (LayoutItem[]), so Layout[] would be a 2D array, causing type errors in consuming components. */
  defaultLayouts: { lg: Layout; md: Layout };
  mobileTabs: { id: string, label: string, icon: React.ReactNode }[];
}

const LAYOUT_VERSION = "1.1.0";

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
  screenId,
  panels,
  defaultLayouts,
  mobileTabs
}) => {
  /** FIX: Defined layouts state with the corrected type to match defaultLayouts. */
  const [layouts, setLayouts] = useState<{ [key: string]: Layout }>(() => {
    const saved = localStorage.getItem(`dpal-layout-${screenId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.version === LAYOUT_VERSION) return parsed.layouts;
      } catch (e) {
        console.error("Layout parse error", e);
      }
    }
    return defaultLayouts;
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState(mobileTabs[0].id);
  const [focusedPanel, setFocusedPanel] = useState<string | null>(null);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem(`dpal-layout-${screenId}`, JSON.stringify({
      version: LAYOUT_VERSION,
      layouts
    }));
  }, [layouts, screenId]);

  /** FIX: Updated onLayoutChange parameters to match the expected signature from ResponsiveGridLayout. */
  const onLayoutChange = (currentLayout: Layout, allLayouts: { [key: string]: Layout }) => {
    setLayouts(allLayouts);
  };

  const resetLayout = () => {
    if (confirm("Reset current workspace calibration?")) {
      setLayouts(defaultLayouts);
      setCollapsedPanels({});
      setFocusedPanel(null);
    }
  };

  const toggleFocus = (panelId: string) => {
    setFocusedPanel(prev => prev === panelId ? null : panelId);
  };

  const toggleCollapse = (panelId: string) => {
    setCollapsedPanels(prev => ({
      ...prev,
      [panelId]: !prev[panelId]
    }));
  };

  return (
    <div className="relative flex flex-col h-full w-full font-mono text-zinc-100">
      {/* Workspace Controls Header - Visible on md+ */}
      <div className="flex items-center justify-between mb-4 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800 no-print">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 px-4 py-1.5 bg-black/60 rounded-xl border border-zinc-800">
             <LayoutIcon className="w-4 h-4 text-cyan-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-white">Terminal_Workspace</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            <button 
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl border-2 transition-all text-[9px] font-black uppercase tracking-widest ${
                isEditMode ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              {isEditMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{isEditMode ? 'Edit_Mode: ON' : 'Edit_Layout'}</span>
            </button>
            <button 
              onClick={resetLayout}
              className="flex items-center space-x-2 px-4 py-1.5 bg-zinc-800 border-2 border-zinc-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
            {focusedPanel && (
                <button 
                    onClick={() => setFocusedPanel(null)}
                    className="flex items-center space-x-2 px-3 py-1 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-500 hover:bg-rose-900/30 transition-all"
                >
                    <Minimize2 className="w-3 h-3" />
                    <span className="text-[8px] font-black uppercase">Exit_Focus</span>
                </button>
            )}
            <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Workspace: Stable</span>
            </div>
        </div>
      </div>

      {/* Grid Display */}
      <div className="flex-grow relative overflow-hidden">
        {/* Mobile Tabbed View (Breakpoint sm) */}
        <div className="block md:hidden h-full flex flex-col">
            <div className="flex-grow overflow-y-auto mb-20">
                {panels.find(p => p.id === activeMobileTab)?.render({
                    isEditMode: false,
                    isFocused: false,
                    isCollapsed: false,
                    onToggleFocus: () => {},
                    onToggleCollapse: () => {}
                })}
            </div>
            {/* Fixed Mobile Tab Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 p-2 flex justify-around z-[100] sm:px-12">
                {mobileTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveMobileTab(tab.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                            activeMobileTab === tab.id ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-600'
                        }`}
                    >
                        {React.isValidElement(tab.icon) && React.cloneElement(tab.icon as React.ReactElement<{className?: string}>, { className: "w-5 h-5 mb-1" })}
                        <span className="text-[8px] font-black uppercase tracking-tighter">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Desktop/Tablet Grid View - Active on md+ */}
        <div className="hidden md:block h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
          {focusedPanel ? (
              <div className="h-full w-full p-2">
                  {panels.find(p => p.id === focusedPanel)?.render({
                      isEditMode: false,
                      isFocused: true,
                      isCollapsed: false,
                      onToggleFocus: () => toggleFocus(focusedPanel),
                      onToggleCollapse: () => {}
                  })}
              </div>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              layouts={layouts}
              breakpoints={{ lg: 1200, md: 768, sm: 480 }}
              cols={{ lg: 12, md: 6, sm: 2 }}
              rowHeight={24}
              draggableHandle=".panel-drag-handle"
              isDraggable={isEditMode}
              isResizable={isEditMode}
              onLayoutChange={onLayoutChange}
              margin={[12, 12]}
              containerPadding={[0, 0]}
            >
              {panels.map(panel => (
                <div key={panel.id}>
                  {panel.render({
                      isEditMode,
                      isFocused: false,
                      isCollapsed: !!collapsedPanels[panel.id],
                      onToggleFocus: () => toggleFocus(panel.id),
                      onToggleCollapse: () => toggleCollapse(panel.id)
                  })}
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>

      {isEditMode && (
          <div className="fixed bottom-10 right-10 z-[200] animate-bounce pointer-events-none">
              <div className="bg-cyan-600 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl flex items-center space-x-3">
                  <Unlock className="w-4 h-4" />
                  <span>Layout Editing Active</span>
              </div>
          </div>
      )}
    </div>
  );
};

export default WorkspaceManager;

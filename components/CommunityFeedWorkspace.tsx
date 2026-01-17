import React, { useState, useMemo, useEffect } from 'react';
import { type Report, type Category, type Hero } from '../types';
import { CATEGORIES_WITH_ICONS } from '../constants';
import WorkspaceManager from './Workspace/WorkspaceManager';
import PanelShell from './Workspace/PanelShell';
import { 
    Search, MapPin, Target, Clock, ShieldCheck, Zap, Broadcast, List, 
    Monitor, Activity, CheckCircle, Award, Star, Search as SearchIcon,
    RefreshCw, Filter, ListFilter, ArrowRight, Share2, Flag, MessageCircle,
    Plus, Coins, Camera, Sparkles, User
} from './icons';
import { useTranslations } from '../i18n';
import { isAiEnabled } from '../services/geminiService';

interface CommunityFeedWorkspaceProps {
    reports: Report[];
    filteredReports: Report[];
    onJoinReportChat: (report: Report) => void;
    onAddNewReport: () => void;
    filters: any;
    setFilters: any;
    hero: Hero;
}

const ImpactMeter: React.FC<{ report: Report }> = ({ report }) => {
    const points = [
        !!report.location,
        true, // Time window always synced
        (report.imageUrls?.length || 0) > 0,
        report.trustScore > 75,
        report.isActionable
    ];
    const score = points.filter(Boolean).length;
    
    let level: 'Low' | 'Medium' | 'Strong' = 'Low';
    if (score >= 4) level = 'Strong';
    else if (score >= 2) level = 'Medium';

    const colorClass = level === 'Strong' ? 'bg-emerald-500' : level === 'Medium' ? 'bg-amber-500' : 'bg-zinc-700';

    return (
        <div className="flex items-center space-x-2">
            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Impact:</span>
            <div className="flex space-x-1">
                {[1, 2, 3].map(i => (
                    /* FIX: Explicitly treated score as number for arithmetic division */
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (score as number) / 1.7 ? colorClass : 'bg-zinc-900'}`}></div>
                ))}
            </div>
            <span className={`text-[8px] font-black uppercase ${level === 'Strong' ? 'text-emerald-500' : level === 'Medium' ? 'text-amber-500' : 'text-zinc-600'}`}>{level}</span>
        </div>
    );
};

const OperationalCard: React.FC<{ report: Report; onJoinChat: () => void }> = ({ report, onJoinChat }) => {
    const { t } = useTranslations();
    const catInfo = CATEGORIES_WITH_ICONS.find(c => c.value === report.category);

    return (
        <div className={`bg-zinc-950 border-2 rounded-[2rem] p-6 space-y-5 transition-all group hover:bg-zinc-900/50 ${report.isActionable ? 'border-rose-900/40 hover:border-rose-500/30' : 'border-zinc-900 hover:border-cyan-900/50'}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                    <div className="text-2xl grayscale group-hover:grayscale-0 transition-all">{catInfo?.icon}</div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[200px]">{report.title}</h4>
                        <div className="flex items-center space-x-2 text-[8px] font-bold text-zinc-600 uppercase">
                            <MapPin className="w-3 h-3 text-rose-500" />
                            <span className="truncate max-w-[120px]">{report.location}</span>
                            <span>•</span>
                            <span>Recent</span>
                        </div>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full border text-[7px] font-black uppercase tracking-widest ${report.severity === 'Critical' ? 'bg-rose-950/20 border-rose-900/40 text-rose-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                    {report.severity}
                </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2 italic">"{report.description}"</p>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
                <ImpactMeter report={report} />
                <div className="flex items-center space-x-3">
                    {/* FIX: Ensured arithmetic addition operands are treated as numbers */}
                    <span className="text-[9px] font-black text-zinc-600 uppercase">{Number(report.imageUrls?.length || 0) + Number(report.attachments?.length || 0)} Telemetry</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${report.status === 'Resolved' ? 'bg-emerald-500' : 'bg-cyan-500'}`}></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
                 <button 
                    onClick={onJoinChat}
                    className="flex items-center justify-center space-x-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase text-zinc-500 hover:text-white hover:border-cyan-500 transition-all"
                >
                    <Broadcast className="w-3 i-3" />
                    <span>Audit Room</span>
                </button>
                <button 
                    className={`flex items-center justify-center space-x-2 py-3 rounded-xl text-[9px] font-black uppercase text-white transition-all shadow-lg active:scale-95 ${report.status === 'Resolved' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}
                >
                    <Zap className="w-3 h-3" />
                    <span>{report.status === 'Resolved' ? 'Add Evidence' : 'Start Mission'}</span>
                </button>
            </div>

            <div className="flex items-center justify-around text-zinc-700 pt-1">
                <button className="flex items-center space-x-1.5 hover:text-emerald-500 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-black uppercase">Confirm</span>
                </button>
                <button className="flex items-center space-x-1.5 hover:text-cyan-500 transition-colors">
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-black uppercase">Resource</span>
                </button>
                <button className="flex items-center space-x-1.5 hover:text-rose-500 transition-colors">
                    <Flag className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-black uppercase">Flag</span>
                </button>
            </div>
        </div>
    );
};

const CommunityFeedWorkspace: React.FC<CommunityFeedWorkspaceProps> = ({ 
    reports, 
    filteredReports, 
    onJoinReportChat, 
    onAddNewReport,
    filters,
    setFilters,
    hero
}) => {
    const { t } = useTranslations();
    const [feedMode, setFeedMode] = useState<'Nearby' | 'Verified' | 'Urgent' | 'My Interests'>('Nearby');
    const [spotlightIndex, setSpotlightIndex] = useState(0);

    const sortedReports = useMemo(() => {
        let list = [...filteredReports];
        if (feedMode === 'Verified') list = list.filter(r => r.trustScore > 85);
        if (feedMode === 'Urgent') list = list.filter(r => r.severity === 'Critical' || r.severity === 'Catastrophic');
        return list;
    }, [filteredReports, feedMode]);

    const spotlightItems = useMemo(() => {
        return reports.filter(r => r.severity === 'Critical' || r.trustScore > 90).slice(0, 3);
    }, [reports]);

    // REAL COMPUTED STATS
    const activeTasksCount = useMemo(() => {
        return reports.filter(r => r.isAuthor && r.status !== 'Resolved' && (r.severity === 'Critical' || r.trustScore < 80)).length;
    }, [reports]);

    const totalImpactShards = useMemo(() => {
        return reports
            .filter(r => r.isAuthor)
            /* FIX: Explicitly cast accumulator and operands to number for arithmetic addition. */
            .reduce((acc: number, r: Report) => Number(acc) + Number(r.imageUrls?.length || 0) + Number(r.attachments?.length || 0), 0);
    }, [reports]);

    const trendLineSummary = useMemo(() => {
        /* FIX: Ensured both sides of relational operator are numeric using .getTime() to avoid type mismatch errors. */
        const dayInMs = 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - dayInMs;
        const last24h = reports.filter(r => r.timestamp.getTime() > cutoff);
        
        if (last24h.length === 0) return "Global ledger baseline stable. No major volatility detected in the last 24h.";
        
        const topCategories = last24h.reduce((acc: Record<string, number>, r: Report) => {
            const key = String(r.category);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        /* FIX: Cast Object.entries to explicit type [string, number][] to resolve arithmetic operation errors on line 173/174. */
        const topCat = (Object.entries(topCategories) as [string, number][]).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
        const criticalCount = last24h.filter(r => r.severity === 'Critical' || r.severity === 'Catastrophic').length;
        const verifiedCount = last24h.filter(r => r.trustScore > 90).length;

        return `In the last 24 hours, ${last24h.length} dispatches synced. ${criticalCount} urgent anomalies identified. Top domain is ${topCat[0]} with ${topCat[1]} shards. ${verifiedCount} records reached high-fidelity consensus.`;
    }, [reports]);

    useEffect(() => {
        const interval = setInterval(() => {
            setSpotlightIndex(prev => (prev + 1) % Math.max(1, spotlightItems.length));
        }, 8000);
        return () => clearInterval(interval);
    }, [spotlightItems]);

    const panels = [
        {
            id: 'filtersPanel',
            title: 'Tactical_Filters',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="filtersPanel" title="Tactical_Filters">
                    <div className="p-6 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">01_Sector_Focus</label>
                            <input 
                                value={filters.location}
                                onChange={e => setFilters({...filters, location: e.target.value})}
                                placeholder="Enter Sector ID..."
                                className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-xs font-bold text-white outline-none focus:border-cyan-500 shadow-inner"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">02_Domain_Scope</label>
                            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {CATEGORIES_WITH_ICONS.map(cat => (
                                    <button 
                                        key={cat.value}
                                        onClick={() => {
                                            const isSel = filters.selectedCategories.includes(cat.value);
                                            setFilters({
                                                ...filters,
                                                selectedCategories: isSel 
                                                    ? filters.selectedCategories.filter((c: any) => c !== cat.value)
                                                    : [...filters.selectedCategories, cat.value]
                                            });
                                        }}
                                        className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center space-x-3 ${
                                            filters.selectedCategories.includes(cat.value) ? 'bg-cyan-500/10 border-cyan-500 text-white' : 'bg-black border-zinc-900 text-zinc-600 hover:border-zinc-700'
                                        }`}
                                    >
                                        <span className="text-lg">{cat.icon}</span>
                                        <span className="text-[10px] font-black uppercase truncate">{cat.value}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={onAddNewReport} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3">
                            <Plus className="w-4 h-4" />
                            <span>New Report</span>
                        </button>
                    </div>
                </PanelShell>
            )
        },
        {
            id: 'mapPanel',
            title: 'Geospatial_Tactical',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="mapPanel" title="Geospatial_Tactical">
                    <div className="h-full bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center group/map">
                        <MapPin className="w-12 h-12 text-zinc-800 animate-pulse opacity-20" />
                        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em] mt-4">Scanning_Nodes...</p>
                        <div className="absolute inset-0 border border-cyan-500/5 pointer-events-none"></div>
                    </div>
                </PanelShell>
            )
        },
        {
            id: 'feedStream',
            title: 'Operational_Ledger_Feed',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="feedStream" title="Operational_Ledger_Feed">
                    <div className="p-6 md:p-8 space-y-8">
                        <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 overflow-x-auto no-scrollbar">
                            {['Nearby', 'Verified', 'Urgent', 'My Interests'].map(mode => (
                                <button 
                                    key={mode} 
                                    onClick={() => setFeedMode(mode as any)}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0 ${feedMode === mode ? 'bg-cyan-600 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-300'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 gap-6 pb-20">
                            {sortedReports.length > 0 ? (
                                sortedReports.map(report => (
                                    <OperationalCard key={report.id} report={report} onJoinChat={() => onJoinReportChat(report)} />
                                ))
                            ) : (
                                <div className="py-20 text-center bg-zinc-950 border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30">
                                    <Broadcast className="w-16 h-16 mx-auto mb-6" />
                                    <p className="text-xs font-black uppercase tracking-widest">No matching dispatches in buffer.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </PanelShell>
            )
        },
        {
            id: 'spotlightPanel',
            title: 'High_Res_Spotlight',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="spotlightPanel" title="High_Res_Spotlight">
                    <div className="p-6 h-full flex flex-col justify-center">
                        {spotlightItems[spotlightIndex] ? (
                            <div className="animate-fade-in space-y-6">
                                <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl">
                                    <div className="flex items-center space-x-2 text-[9px] font-black text-emerald-500 uppercase mb-2">
                                        <Star className="w-3 h-3 fill-current"/><span>Neural_Pick</span>
                                    </div>
                                    <h4 className="text-sm font-black text-white uppercase leading-tight mb-3 line-clamp-2">{spotlightItems[spotlightIndex].title}</h4>
                                    <button 
                                        onClick={() => onJoinReportChat(spotlightItems[spotlightIndex])}
                                        className="w-full bg-white text-black font-black py-2.5 rounded-xl text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                                    >
                                        Verify This Now
                                    </button>
                                </div>
                                <div className="flex justify-center space-x-1.5">
                                    {spotlightItems.map((_, i) => (
                                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === spotlightIndex ? 'bg-emerald-500' : 'bg-zinc-800'}`}></div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-[9px] font-black text-zinc-700 uppercase text-center">Spotlight_Buffering...</p>
                        )}
                    </div>
                </PanelShell>
            )
        },
        {
            id: 'actionQueue',
            title: 'Contextual_Directives',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="actionQueue" title="Contextual_Directives">
                    <div className="p-6 space-y-4">
                        <button className="w-full p-4 bg-zinc-950 border border-emerald-900/30 rounded-2xl flex items-center space-x-4 hover:border-emerald-500 transition-all group text-left">
                             <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20"><ShieldCheck className="w-5 h-5 text-emerald-500"/></div>
                             <div className="text-left">
                                <p className="text-[10px] font-black text-white uppercase tracking-tight">Bulk Verify Shards</p>
                                <p className="text-[8px] font-bold text-zinc-600 uppercase">+250 XP Reward</p>
                             </div>
                        </button>
                        <button className="w-full p-4 bg-zinc-950 border border-cyan-900/30 rounded-2xl flex items-center space-x-4 hover:border-cyan-500 transition-all group text-left">
                             <div className="p-3 bg-cyan-500/10 rounded-xl group-hover:bg-cyan-500/20"><Camera className="w-5 h-5 text-cyan-400"/></div>
                             <div className="text-left">
                                <p className="text-[10px] font-black text-white uppercase tracking-tight">Sync Field Telemetry</p>
                                <p className="text-[8px] font-bold text-zinc-600 uppercase">Sector 7 Requested</p>
                             </div>
                        </button>
                    </div>
                </PanelShell>
            )
        },
        {
            id: 'myOpsPanel',
            title: 'Personal_Sync_Logs',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="myOpsPanel" title="Personal_Sync_Logs">
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center">
                                <p className="text-[7px] font-black text-zinc-600 uppercase mb-1">Active_Tasks</p>
                                <p className="text-xl font-black text-white tracking-tighter">{String(activeTasksCount).padStart(2, '0')}</p>
                            </div>
                            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center">
                                <p className="text-[7px] font-black text-zinc-600 uppercase mb-1">Impact_Shards</p>
                                <p className="text-xl font-black text-emerald-500 tracking-tighter">{String(totalImpactShards).padStart(2, '0')}</p>
                            </div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group">
                            <div className="flex items-center space-x-3">
                                <Coins className="w-4 h-4 text-amber-500" />
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reserve</span>
                            </div>
                            <span className="text-sm font-black text-white">{hero.heroCredits} HC</span>
                        </div>
                    </div>
                </PanelShell>
            )
        },
        {
            id: 'intelPanel',
            title: 'Neural_Context_Buffer',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="intelPanel" title="Neural_Context_Buffer">
                    <div className="p-6 flex items-center gap-8">
                        <div className="flex-shrink-0 p-5 bg-purple-500/10 rounded-[2.5rem] border border-purple-500/30">
                            <Sparkles className="w-10 h-10 text-purple-400 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest leading-relaxed italic border-l-2 border-purple-500 pl-4">
                                "{trendLineSummary}"
                            </p>
                        </div>
                    </div>
                </PanelShell>
            )
        },
        {
            id: 'aiStatusPanelCommunity',
            title: 'System_Oracle_Link',
            render: (ctx: any) => (
                <PanelShell {...ctx} id="aiStatusPanelCommunity" title="System_Oracle_Link">
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${isAiEnabled() ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            <span className="text-[10px] font-black uppercase text-white tracking-widest">Oracle: {isAiEnabled() ? 'Synced' : 'Isolated'}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-[9px] font-black text-zinc-600 uppercase">
                             <span>Ping: 42ms</span>
                             <span>Load: 12%</span>
                        </div>
                    </div>
                </PanelShell>
            )
        }
    ];

    const defaultLayouts = {
        lg: [
            { i: 'filtersPanel', x: 0, y: 0, w: 3, h: 14, minW: 2, minH: 10 },
            { i: 'mapPanel', x: 0, y: 14, w: 3, h: 12, minW: 2, minH: 10 },
            { i: 'feedStream', x: 3, y: 0, w: 6, h: 26, minW: 4, minH: 16 },
            { i: 'spotlightPanel', x: 9, y: 0, w: 3, h: 10, minW: 2, minH: 8 },
            { i: 'actionQueue', x: 9, y: 10, w: 3, h: 8, minW: 2, minH: 8 },
            { i: 'myOpsPanel', x: 9, y: 18, w: 3, h: 8, minW: 2, minH: 8 },
            { i: 'intelPanel', x: 3, y: 26, w: 6, h: 6, minW: 4, minH: 6 },
            { i: 'aiStatusPanelCommunity', x: 0, y: 26, w: 3, h: 6, minW: 2, minH: 4 }
        ],
        md: [
            { i: 'filtersPanel', x: 0, y: 0, w: 2, h: 12, minW: 2, minH: 10 },
            { i: 'mapPanel', x: 0, y: 12, w: 2, h: 14, minW: 2, minH: 10 },
            { i: 'feedStream', x: 2, y: 0, w: 4, h: 20, minW: 3, minH: 14 },
            { i: 'spotlightPanel', x: 2, y: 20, w: 4, h: 8, minW: 2, minH: 8 },
            { i: 'actionQueue', x: 0, y: 26, w: 3, h: 10, minW: 2, minH: 8 },
            { i: 'myOpsPanel', x: 3, y: 26, w: 3, h: 10, minW: 2, minH: 8 },
            { i: 'intelPanel', x: 0, y: 36, w: 6, h: 10, minW: 4, minH: 8 },
            { i: 'aiStatusPanelCommunity', x: 0, y: 46, w: 6, h: 6, minW: 2, minH: 4 }
        ]
    };

    const mobileTabs = [
        { id: 'feedStream', label: 'Feed', icon: <List /> },
        { id: 'mapPanel', label: 'Map', icon: <MapPin /> },
        { id: 'filtersPanel', label: 'Filters', icon: <Search /> },
        { id: 'spotlightPanel', label: 'Spotlight', icon: <Star /> },
        { id: 'myOpsPanel', label: 'My Ops', icon: <User /> }
    ];

    return (
        <div className="flex flex-col h-[90vh] bg-black font-mono">
            <header className="bg-zinc-900 border-b border-zinc-800 px-8 py-4 flex flex-col md:flex-row justify-between items-center z-30 flex-shrink-0 gap-4">
                <div className="flex items-center space-x-4">
                    <h1 className="text-xl font-black uppercase tracking-tighter text-white">Community_Ledger_OS</h1>
                </div>
            </header>

            <div className="flex-grow p-4 md:p-6 overflow-hidden">
                <WorkspaceManager 
                    screenId="community-feed"
                    panels={panels}
                    defaultLayouts={defaultLayouts}
                    mobileTabs={mobileTabs}
                />
            </div>
        </div>
    );
};

export default CommunityFeedWorkspace;

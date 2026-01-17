
import React, { useState, useEffect } from 'react';
import { useTranslations } from '../i18n';
import { List, ArrowRight, Search, Mic, Loader, Megaphone, Sparkles, Monitor, Broadcast, Zap, Database, ShieldCheck, Target, Map, User, Activity, Award, Hash, Gem, FileText, Phone, Globe, Package, Scale, AlertTriangle, Heart, Coins, X } from './icons';
import { Category } from '../types';
import { CATEGORIES_WITH_ICONS } from '../constants';
import BlockchainStatusPanel from './BlockchainStatusPanel';

interface MainMenuProps {
    onNavigate: (view: any, category?: Category, extra?: any) => void;
    totalReports: number;
    onGenerateMissionForCategory: (category: Category) => void;
}

const PrimaryNavModule: React.FC<{
    icon: React.ReactNode;
    label: string;
    subLabel: string;
    onClick: () => void;
    colorClass: string;
    status: string;
    highlight?: boolean;
}> = ({ icon, label, subLabel, onClick, colorClass, status, highlight }) => {
    return (
        <button 
            type="button"
            onClick={onClick}
            className={`relative flex flex-col items-start p-6 rounded-[1.8rem] bg-zinc-900 border-2 transition-all group overflow-hidden h-full text-left shadow-xl ${
                highlight ? 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.2)]' : 'border-zinc-700 hover:border-zinc-500'
            }`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${colorClass}-500/10 blur-3xl group-hover:bg-${colorClass}-500/20 transition-colors`}></div>
            
            <div className="relative w-full flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl bg-zinc-950 border border-zinc-700 group-hover:border-${colorClass}-500/50 transition-all shadow-lg`}>
                    <div className={`text-${colorClass}-400 group-hover:scale-110 transition-transform`}>{icon}</div>
                </div>
                <div className="flex items-center space-x-2 bg-black/60 px-3 py-1 rounded-lg border border-zinc-800">
                    <div className={`w-1.5 h-1.5 rounded-full bg-${colorClass}-500 animate-pulse shadow-[0_0_8px_${colorClass}]`}></div>
                    <span className={`text-[8px] font-black uppercase tracking-widest text-${colorClass}-500`}>{status}</span>
                </div>
            </div>

            <div className="relative mt-auto w-full">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-none mb-2 break-words">{label}</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-tight line-clamp-2">{subLabel}</p>
            </div>

            <div className={`absolute bottom-6 right-6 text-${colorClass}-500 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 duration-500`}>
                <ArrowRight className="w-5 h-5" />
            </div>
        </button>
    );
};

const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, totalReports, onGenerateMissionForCategory }) => {
    const { t } = useTranslations();
    const [categorySearch, setCategorySearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<Category | null>(null);

    return (
        <div className="animate-fade-in max-w-[1400px] mx-auto px-4 pb-24 font-mono">
            <header className="mb-12 text-center flex flex-col items-center relative pt-8">
                <div className="relative z-10 space-y-8 flex flex-col items-center">
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase neon-glimmer max-w-5xl leading-[0.9] md:leading-none px-4">
                        Decentralized Public Accountability Ledger
                    </h1>
                    <p className="text-sm text-zinc-400 font-bold uppercase tracking-[0.5em] mt-2">Global Oversight & P2P Accountability Engine</p>
                </div>
            </header>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 relative z-20">
                <PrimaryNavModule 
                    icon={<Megaphone className="w-8 h-8" />}
                    label="FILE_A_REPORT"
                    subLabel="Initialize Genesis Accountability Shard"
                    status="READY"
                    colorClass="rose"
                    onClick={() => onNavigate('categorySelection')}
                />

                <PrimaryNavModule 
                    icon={<Zap className="w-8 h-8" />}
                    label="REPORT_FOR_DUTY"
                    subLabel="Interactive Guided Training Protocol"
                    status="INDUCTION"
                    colorClass="cyan"
                    highlight
                    onClick={() => onNavigate('tutorial')}
                />

                <PrimaryNavModule 
                    icon={<Database className="w-8 h-8" />}
                    label="PUBLIC_LEDGER"
                    subLabel="View All Peer-Verified Shards"
                    status="LIVE_SYNC"
                    colorClass="emerald"
                    onClick={() => onNavigate('transparencyDatabase')}
                />

                <PrimaryNavModule 
                    icon={<Target className="w-8 h-8" />}
                    label="FIELD_MISSIONS"
                    subLabel="Active Regional Tasks & Directives"
                    status="ACTIVE"
                    colorClass="amber"
                    onClick={() => onNavigate('liveIntelligence')}
                />
            </div>

            <BlockchainStatusPanel totalReports={totalReports} />
            
            <div className="my-20 border-t border-zinc-900"></div>
            
            <div className="flex flex-col items-center gap-8 mb-16 max-w-4xl mx-auto relative z-20">
                <h2 className="text-3xl font-black text-white tracking-tighter text-center uppercase leading-none">Dispatch_Directory</h2>
                <div className="w-full">
                     <div className="relative group">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-8">
                            <Search className="h-6 w-6 text-zinc-600 group-focus-within:text-cyan-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Filter targets by domain..."
                          className="w-full pl-20 pr-20 py-6 bg-zinc-950 border-2 border-zinc-800 rounded-[2.5rem] focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-white font-bold tracking-tight text-xl shadow-inner uppercase placeholder:text-zinc-900"
                        />
                    </div>
                </div>
            </div>
            
            <div className="bg-black/40 rounded-[3.4rem] p-8 md:p-12 border border-zinc-900 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {[...CATEGORIES_WITH_ICONS]
                      .sort((a, b) => t(a.translationKey).localeCompare(t(b.translationKey)))
                      .filter(cat => t(cat.translationKey).toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((cat) => (
                        <div
                            key={cat.value}
                            className={`group/card relative rounded-[2.5rem] overflow-hidden transition-all duration-300 border-2 ${activeCategory === cat.value ? 'bg-zinc-900 border-cyan-500 shadow-2xl scale-[1.03] z-20' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 shadow-lg'}`}
                        >
                            <button
                                type="button"
                                onClick={() => setActiveCategory(activeCategory === cat.value ? null : cat.value)}
                                className="w-full flex flex-col items-center justify-center text-center p-10 min-h-[200px]"
                            >
                                <div className="text-6xl mb-6 transition-transform duration-500 group-hover/card:scale-110">
                                {cat.icon}
                                </div>
                                <span className="font-black text-lg text-white transition-colors tracking-tight uppercase">
                                {t(cat.translationKey)}
                                </span>
                            </button>
                            {activeCategory === cat.value && (
                                <div className="p-8 border-t border-zinc-800 animate-fade-in-fast flex flex-col gap-4 bg-zinc-950">
                                    <button
                                        type="button"
                                        onClick={() => onNavigate('reportSubmission', cat.value)}
                                        className="group/btn relative w-full flex items-center justify-center space-x-4 bg-white text-black font-black py-5 px-6 rounded-2xl hover:bg-rose-50 transition-all uppercase text-xs tracking-widest shadow-xl active:scale-95 overflow-hidden border-2 border-transparent hover:border-rose-500/50"
                                    >
                                        <Megaphone className="w-5 h-5 relative z-10 text-rose-600" />
                                        <span className="relative z-10">File_A_Report</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

             <style>{`
                .neon-glimmer {
                    color: #fff;
                    text-shadow: 0 0 7px #fff, 0 0 10px #06b6d4, 0 0 21px #06b6d4;
                    animation: glimmer 3s infinite alternate;
                }
                @keyframes glimmer {
                    from { opacity: 1; text-shadow: 0 0 7px #fff, 0 0 10px #06b6d4, 0 0 21px #06b6d4; }
                    to { opacity: 0.7; text-shadow: 0 0 4px #fff, 0 0 7px #06b6d4, 0 0 15px #06b6d4; }
                }
            `}</style>
        </div>
    );
};

export default MainMenu;

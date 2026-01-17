
import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, User, Coins, Gem, Globe, Maximize2, Search, Monitor, Broadcast, Store, List, Package, Database, Zap, Target, Award, ChevronLeft, ChevronRight, Activity, X, Home, Sparkles, AlertTriangle, Megaphone } from './icons';
import { useTranslations } from '../i18n';
import { type Hero, SubscriptionTier } from '../types';
import { TextScale, type View } from '../App';
import { isAiEnabled } from '../services/geminiService';

interface HeaderProps {
    onNavigateToHeroHub: () => void;
    onNavigateHome: () => void;
    onNavigateToReputationAndCurrency: () => void;
    onNavigateMissions: () => void;
    onNavigate: (view: View, category?: any, tab?: any) => void;
    hero: Hero;
    textScale: TextScale;
    setTextScale: (scale: TextScale) => void;
    networkStatus: 'OFFLINE' | 'SYNCING' | 'LIVE' | 'MOCK';
}

const AiStatusIndicator: React.FC<{ status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' }> = ({ status }) => {
    const config = {
        ONLINE: { label: 'AI_ON', color: 'text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-950/20', border: 'border-emerald-500/30' },
        OFFLINE: { label: 'AI_OFF', color: 'text-zinc-600', dot: 'bg-zinc-700', bg: 'bg-zinc-900', border: 'border-zinc-800' },
        DEGRADED: { label: 'AI_DEGRADED', color: 'text-rose-400', dot: 'bg-rose-500', bg: 'bg-rose-950/20', border: 'border-rose-500/30' }
    }[status];

    return (
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all duration-500 ${config.bg} ${config.border}`}>
            <div className="relative flex items-center justify-center">
                <div className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status !== 'OFFLINE' ? 'animate-pulse shadow-[0_0_8px_currentColor]' : ''}`}></div>
                {status === 'ONLINE' && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>}
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest ${config.color}`}>
                {config.label}
            </span>
            {status === 'ONLINE' ? <Sparkles className="w-2.5 h-2.5 text-emerald-500" /> : <AlertTriangle className={`w-2.5 h-2.5 ${config.color}`} />}
        </div>
    );
};

const Header: React.FC<HeaderProps> = ({ 
    onNavigateToHeroHub, 
    onNavigateHome, 
    onNavigateToReputationAndCurrency, 
    onNavigateMissions,
    onNavigate,
    hero, 
    textScale, 
    setTextScale,
    networkStatus
}) => {
  const [aiStatus, setAiStatus] = useState<'ONLINE' | 'OFFLINE' | 'DEGRADED'>('OFFLINE');
  
  useEffect(() => {
    setAiStatus(isAiEnabled() ? 'ONLINE' : 'OFFLINE');
  }, []);

  const toggleScale = () => {
    if (textScale === 'standard') setTextScale('large');
    else if (textScale === 'large') setTextScale('ultra');
    else if (textScale === 'ultra') setTextScale('magnified');
    else setTextScale('standard');
  };

  const getTierColor = (tier: SubscriptionTier) => {
      switch(tier) {
          case SubscriptionTier.Oracle: return 'text-emerald-400 border-emerald-500/50';
          case SubscriptionTier.Sentinel: return 'text-amber-400 border-amber-500/50';
          case SubscriptionTier.Guardian: return 'text-cyan-400 border-cyan-500/50';
          default: return 'text-zinc-500 border-zinc-800';
      }
  };

  const getNetworkLabel = () => {
      switch(networkStatus) {
          case 'LIVE': return 'LIVE_LEDGER: SYNCED';
          case 'MOCK': return 'LOCAL_MODE: SIMULATED';
          case 'SYNCING': return 'SYNCING_NODES...';
          default: return 'NETWORK: ISOLATED';
      }
  };

  return (
    <header className="bg-black border-b border-zinc-900 sticky top-0 z-[100] font-mono w-full flex flex-col">
      <div className="w-full px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          
          <button onClick={onNavigateHome} className="flex items-center space-x-3 group flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/10 blur-lg group-hover:bg-cyan-400/20 transition-all"></div>
              <div className="relative p-2 bg-zinc-900 border border-cyan-500/30 rounded-xl group-hover:border-cyan-400 transition-all">
                  <ShieldCheck className="h-6 w-6 text-cyan-500" />
              </div>
            </div>
            <div className="text-left leading-none hidden xs:block">
              <h1 className="text-xl font-black text-white tracking-tighter uppercase">DPAL</h1>
              <p className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-1">CORE_V2.5</p>
            </div>
          </button>

          <div className="flex-grow flex items-center justify-center">
              <div className={`flex items-center space-x-4 px-5 py-2 rounded-full border bg-black/40 transition-all duration-700 ${
                  networkStatus === 'LIVE' ? 'border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 
                  networkStatus === 'MOCK' ? 'border-cyan-500/30 text-cyan-500' :
                  networkStatus === 'SYNCING' ? 'border-amber-500/30 text-amber-500' : 'border-zinc-800 text-zinc-600'
              }`}>
                  <div className={`w-2 h-2 rounded-full ${
                      networkStatus === 'LIVE' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 
                      networkStatus === 'MOCK' ? 'bg-cyan-500 animate-pulse shadow-[0_0_8px_#22d3ee]' :
                      networkStatus === 'SYNCING' ? 'bg-amber-500 animate-spin' : 'bg-zinc-800'
                  }`}></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">{getNetworkLabel()}</span>
              </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
             <AiStatusIndicator status={aiStatus} />
             
             <div className="hidden lg:flex flex-col items-end mr-2 text-right">
                <span className="text-[9px] font-black text-white uppercase tracking-tighter leading-none">{hero.name}</span>
                <button 
                    onClick={() => onNavigate('subscription')}
                    className={`text-[7px] font-bold uppercase tracking-widest mt-1 px-2 py-0.5 rounded border bg-black/40 hover:bg-white/10 transition-colors ${getTierColor(hero.subscriptionTier)}`}
                >
                    {hero.subscriptionTier.replace('_', ' ')}
                </button>
             </div>

             <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 pr-2 md:pr-3 space-x-2 md:space-x-3 shadow-inner">
                <button 
                    onClick={onNavigateToHeroHub}
                    className="w-7 h-7 md:w-8 md:h-8 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center hover:border-cyan-500 transition-colors"
                >
                    {hero.personas.find(p => p.id === hero.equippedPersonaId)?.imageUrl ? (
                        <img src={hero.personas.find(p => p.id === hero.equippedPersonaId)?.imageUrl} alt="P" className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-4 h-4 text-zinc-600" />
                    )}
                </button>
                <button onClick={onNavigateToReputationAndCurrency} className="flex items-center space-x-2 outline-none group">
                    <Coins className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col items-start leading-none">
                        <span className="font-black text-white text-[9px] md:text-[10px]">{hero.heroCredits.toLocaleString()}</span>
                        <span className="text-[6px] font-bold text-zinc-500 uppercase tracking-tighter mt-0.5">$0.005/CREDIT</span>
                    </div>
                </button>
                <button onClick={toggleScale} className="hidden sm:block text-zinc-600 hover:text-white transition-colors pl-2" title="Interface Scale">
                    <Maximize2 className="w-3.5 h-3.5" />
                </button>
             </div>
          </div>
      </div>
    </header>
  );
};

export default Header;

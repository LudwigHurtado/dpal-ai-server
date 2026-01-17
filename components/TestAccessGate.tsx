
import React, { useState } from 'react';
import { ShieldCheck, Loader, Lock, Activity } from './icons';

interface TestAccessGateProps {
  onGranted: () => void;
}

const STORAGE_KEY = 'dpal_test_access_granted_v1';

const TestAccessGate: React.FC<TestAccessGateProps> = ({ onGranted }) => {
  // Use env values with fallbacks for safety
  const EXPECTED_KEY = (process.env.DPAL_TEST_ACCESS_KEY || 'DPAL-BETA-2026').trim();
  
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    // Simulate neural handshake delay for atmospheric effect
    setTimeout(() => {
      const entered = input.trim();
      if (entered === EXPECTED_KEY) {
        localStorage.setItem(STORAGE_KEY, 'true');
        onGranted();
      } else {
        setError('PROTOCOL_ERROR: ACCESS_KEY_INVALID');
        setIsVerifying(false);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-mono selection:bg-cyan-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.05),transparent_70%)] pointer-events-none"></div>
      
      {/* Decorative scanline */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>

      <div className="relative w-full max-w-md bg-zinc-950 border-2 border-zinc-800 rounded-[2.5rem] p-10 shadow-4xl animate-fade-in overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900 overflow-hidden">
            {isVerifying && <div className="h-full bg-cyan-500 animate-loading-bar shadow-[0_0_15px_cyan]"></div>}
        </div>

        <div className="text-center space-y-8 relative z-10">
          <div className="relative inline-block">
             <div className="absolute -inset-8 bg-cyan-500/10 blur-3xl animate-pulse"></div>
             <div className="relative p-6 bg-zinc-900 border border-cyan-500/30 rounded-3xl">
                {isVerifying ? (
                    <Activity className="w-12 h-12 text-cyan-400 animate-pulse" />
                ) : (
                    <ShieldCheck className="w-12 h-12 text-zinc-600" />
                )}
             </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Operative_Sync</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em]">DPAL_Access_Gate_v2.5</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest text-left pl-4">Input_Beta_Key</label>
              <div className="relative">
                <input
                  type="password"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(''); }}
                  placeholder="•••• •••• ••••"
                  disabled={isVerifying}
                  className="w-full bg-black border-2 border-zinc-800 rounded-2xl px-6 py-5 text-center font-black text-cyan-500 tracking-[0.5em] outline-none focus:border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all placeholder:text-zinc-900 placeholder:tracking-normal"
                />
                {isVerifying && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl">
                        <Loader className="w-6 h-6 animate-spin text-cyan-500" />
                    </div>
                )}
              </div>
              {error && <p className="text-[9px] font-black text-rose-500 uppercase animate-pulse">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isVerifying || !input.trim()}
              className="w-full bg-white hover:bg-cyan-50 text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-xs shadow-2xl active:scale-95 transition-all disabled:opacity-20"
            >
              {isVerifying ? 'SYNCING_NODES...' : 'Initialize_Link'}
            </button>
          </form>

          <div className="pt-6 border-t border-zinc-900 mt-4">
             <p className="text-[9px] text-zinc-700 font-bold uppercase leading-relaxed">
                Verification required for distributed ledger stability. Connection remains active until terminal closure.
             </p>
          </div>
        </div>
      </div>

      <style>{`
        .animate-loading-bar { animation: loading-bar 1.2s linear infinite; }
        @keyframes loading-bar { 0% { width: 0; transform: translateX(-100%); } 100% { width: 100%; transform: translateX(100%); } }
        .shadow-4xl { box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
      `}</style>
    </div>
  );
};

export default TestAccessGate;

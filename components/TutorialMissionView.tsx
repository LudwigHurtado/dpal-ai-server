
import React, { useState, useMemo, useEffect } from 'react';
/* FIX: Removed 'type' prefix from Category import to allow its usage as a value (Category.Other). */
import { Category, type Report, type FieldPrompt, type MissionAction, type TutorialMission, type SeverityLevel } from '../types';
import { useTranslations } from '../i18n';
import { ArrowLeft, CheckCircle, Zap, Clock, ShieldCheck, Target, Camera, Loader, Database, Sparkles, Box, FileText, Activity, X } from './icons';
import PanelShell from './Workspace/PanelShell';
import { tutorialReportForDutyMission } from '../data/tutorialMission';
import { tutorialOverlaySteps } from '../data/tutorialOverlaySteps';
import TutorialOverlay from './TutorialOverlay';

interface TutorialMissionViewProps {
  onComplete: (reportData: Partial<Report>, isPractice: boolean) => void;
  onSkip: () => void;
}

const TutorialMissionView: React.FC<TutorialMissionViewProps> = ({ onComplete, onSkip }) => {
  const { t } = useTranslations();
  const [activeActionIndex, setActiveActionIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data stores
  const [tutorialData, setTutorialData] = useState({ mode: '' as 'PRACTICE' | 'REAL' | '', operatingArea: '', reviewAccepted: false });
  const [draftReport, setDraftReport] = useState({ category: '' as Category | '', severity: 'Standard' as SeverityLevel, summary: '' });
  const [evidence, setEvidence] = useState<{ items: string[], notes: string }>({ items: [], notes: '' });
  const [riskAssessment, setRiskAssessment] = useState({ safePublic: false, noConfrontation: false, noRestrictedAccess: false });

  const activeAction = tutorialReportForDutyMission.actions[activeActionIndex];
  const overlayStep = tutorialOverlaySteps[activeActionIndex];

  const canAdvance = useMemo(() => {
    return activeAction.requiredPrompts.every(prompt => {
      if (!prompt.required) return true;
      const { entity, field } = prompt.storedAs;
      let val: any;
      if (entity === 'tutorial') val = (tutorialData as any)[field];
      else if (entity === 'report') val = (draftReport as any)[field];
      else if (entity === 'evidence') val = (evidence as any)[field];
      else if (entity === 'riskAssessment') val = (riskAssessment as any)[field];

      if (prompt.responseType === 'checkbox') return val === true;
      if (prompt.responseType === 'text') {
          const rule = prompt.validationRules?.find(r => r.rule === 'minLength');
          const minLen = typeof rule?.value === 'number' ? rule.value : 1;
          return (val || '').length >= minLen;
      }
      if (prompt.responseType === 'multi-select' || prompt.responseType === 'photo') {
          return val !== '' && val !== null && (Array.isArray(val) ? val.length > 0 : true);
      }
      return !!val;
    });
  }, [activeAction, tutorialData, draftReport, evidence, riskAssessment]);

  const updateData = (prompt: FieldPrompt, value: any) => {
    const { entity, field } = prompt.storedAs;
    if (entity === 'tutorial') setTutorialData(prev => ({ ...prev, [field]: value }));
    else if (entity === 'report') setDraftReport(prev => ({ ...prev, [field]: value }));
    else if (entity === 'evidence') setEvidence(prev => ({ ...prev, [field]: value }));
    else if (entity === 'riskAssessment') setRiskAssessment(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (activeActionIndex < tutorialReportForDutyMission.actions.length - 1) {
        setIsProcessing(true);
        setTimeout(() => {
            setActiveActionIndex(prev => prev + 1);
            setIsProcessing(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 800);
    } else {
        const isPractice = tutorialData.mode === 'PRACTICE';
        const finalReport: Partial<Report> = {
            title: isPractice ? `PRACTICE: ${draftReport.category} REPORT` : `GENESIS: ${draftReport.category} REPORT`,
            description: draftReport.summary,
            /* FIX: Correctly used Category enum value Category.Other. */
            category: (draftReport.category as Category) || Category.Other,
            location: tutorialData.operatingArea || 'Global Sector',
            severity: draftReport.severity,
            isActionable: draftReport.severity === 'Critical',
            trustScore: 100,
            imageUrls: evidence.items,
            isTutorial: true,
            structuredData: {
                tutorialMode: tutorialData.mode,
                riskAssessment: riskAssessment,
                fieldNotes: evidence.notes
            }
        };
        onComplete(finalReport, isPractice);
    }
  };

  const renderPrompt = (prompt: FieldPrompt) => {
    const { entity, field } = prompt.storedAs;
    let value: any;
    if (entity === 'tutorial') value = (tutorialData as any)[field];
    else if (entity === 'report') value = (draftReport as any)[field];
    else if (entity === 'evidence') value = (evidence as any)[field];
    else if (entity === 'riskAssessment') value = (riskAssessment as any)[field];

    const dataTut = activeAction.id === 'tut_mode' ? 'mode' :
                    activeAction.id === 'tut_area' ? 'area' :
                    activeAction.id === 'tut_report_shell' ? 'category' :
                    activeAction.id === 'tut_event_context' ? 'summary' :
                    activeAction.id === 'tut_evidence' ? 'evidence' :
                    activeAction.id === 'tut_safety' ? 'safety' :
                    activeAction.id === 'tut_review' ? 'finalize' : '';

    const containerProps = dataTut ? { "data-tut": dataTut } : {};

    switch (prompt.responseType) {
      case 'multi-select':
        return (
          <div key={prompt.id} className="space-y-4" {...containerProps}>
            <label className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">{prompt.promptText}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {prompt.options?.map(opt => (
                <button
                  key={opt}
                  onClick={() => updateData(prompt, opt)}
                  className={`px-4 py-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all ${value === opt ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg scale-105' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      case 'checkbox':
        return (
            <button 
                key={prompt.id}
                onClick={() => updateData(prompt, !value)}
                className={`w-full flex items-center space-x-4 p-5 rounded-2xl border-2 transition-all group ${value ? 'bg-emerald-950/20 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                {...containerProps}
            >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${value ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-black border-zinc-900 group-hover:border-zinc-700'}`}>
                    {value && <CheckCircle className="w-4 h-4 text-black" />}
                </div>
                <span className="text-[11px] font-black uppercase text-left">{prompt.promptText}</span>
            </button>
        );
      case 'text':
        return (
          <div key={prompt.id} className="space-y-2" {...containerProps}>
            <label className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">{prompt.promptText}</label>
            <textarea 
              value={value || ''}
              onChange={e => updateData(prompt, e.target.value)}
              className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-6 text-sm font-bold text-white outline-none focus:border-cyan-500 transition-all placeholder:text-zinc-900 min-h-[120px] shadow-inner"
              placeholder="Input tactical intelligence..."
            />
          </div>
        );
      case 'photo':
        return (
          <div key={prompt.id} className="space-y-4" {...containerProps}>
             <label className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">{prompt.promptText}</label>
             <div className="aspect-video bg-zinc-950 border-2 border-dashed border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:border-cyan-500 transition-all group shadow-inner"
                  onClick={() => {
                      // Simulated upload
                      const dummy = "https://picsum.photos/seed/tutorial/800/600";
                      updateData(prompt, [dummy]);
                  }}>
                {value && value.length > 0 ? (
                    <img src={value[0]} alt="T" className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <>
                        <Camera className="w-12 h-12 text-zinc-800 group-hover:text-cyan-400 transition-colors" />
                        <p className="mt-4 text-[10px] font-black uppercase text-zinc-700">Attach Sample Telemetry Shard</p>
                    </>
                )}
             </div>
          </div>
        )
      default: return null;
    }
  };

  return (
    <div className="bg-black min-h-screen text-white font-mono p-4 md:p-8 animate-fade-in">
        <TutorialOverlay 
            step={overlayStep} 
            onNext={canAdvance ? handleNext : () => alert("Protocol Warning: Action incomplete.")} 
            onSkip={onSkip} 
            isLastStep={activeActionIndex === tutorialReportForDutyMission.actions.length - 1} 
        />

        <div className="max-w-6xl mx-auto space-y-12 pb-32">
            <header className="flex justify-between items-center bg-zinc-900/50 p-8 rounded-[3rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Target className="w-48 h-48 text-cyan-500"/></div>
                <div className="flex items-center space-x-8">
                    <div className="p-4 bg-cyan-600 rounded-2xl shadow-3xl border-b-4 border-cyan-800 animate-pulse">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Protocol_Genesis</h1>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em] mt-2">Guided Induction Mission v1.0</p>
                    </div>
                </div>
                <div className="text-right hidden md:block">
                     <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Mission_Progress</p>
                     <div className="flex items-center space-x-3">
                         <span className="text-2xl font-black text-cyan-400">{Math.round(((activeActionIndex + 1) / tutorialReportForDutyMission.actions.length) * 100)}%</span>
                         <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                             <div className="h-full bg-cyan-500 shadow-[0_0_10px_cyan]" style={{ width: `${((activeActionIndex + 1) / tutorialReportForDutyMission.actions.length) * 100}%` }}></div>
                         </div>
                     </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Timeline Rail */}
                <aside className="lg:col-span-3 space-y-4">
                    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] space-y-10 relative shadow-inner overflow-hidden">
                        <div className="absolute left-[47px] top-12 bottom-12 w-0.5 bg-zinc-800"></div>
                        {tutorialReportForDutyMission.actions.map((act, idx) => {
                            const isCurrent = idx === activeActionIndex;
                            const isPast = idx < activeActionIndex;
                            return (
                                <div key={act.id} className={`flex items-center space-x-6 relative z-10 transition-all duration-500 ${idx > activeActionIndex ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                                    <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                                        isPast ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                        isCurrent ? 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_15px_cyan]' :
                                        'bg-zinc-950 border-zinc-800 text-zinc-700'
                                    }`}>
                                        {isPast ? <CheckCircle className="w-5 h-5" /> : act.id.startsWith('tut_evidence') ? <Camera className="w-4 h-4"/> : act.id.startsWith('tut_safety') ? <ShieldCheck className="w-4 h-4"/> : <Activity className="w-4 h-4"/>}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isCurrent ? 'text-white' : 'text-zinc-500'}`}>{act.title.replace(' ', '_')}</span>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* Main Action Console */}
                <main className="lg:col-span-9">
                    <PanelShell id="action_console" title="Directive_Execution_Link">
                         <div className="p-8 md:p-12 space-y-12">
                            <div className="space-y-4">
                                <div className="flex items-center space-x-4">
                                     <div className="p-3 bg-cyan-950/40 rounded-xl border border-cyan-900/40">
                                         <Zap className="w-6 h-6 text-cyan-400" />
                                     </div>
                                     <h2 className="text-4xl font-black uppercase tracking-tighter text-white">{activeAction.title}</h2>
                                </div>
                                <p className="text-base text-zinc-400 font-bold leading-relaxed border-l-4 border-cyan-500 pl-8 italic uppercase">
                                    "{activeAction.objective}"
                                </p>
                            </div>

                            <div className="space-y-10">
                                {activeAction.requiredPrompts.map(prompt => renderPrompt(prompt))}
                            </div>

                            <div className="pt-10 border-t border-zinc-800">
                                <button 
                                    onClick={handleNext}
                                    disabled={!canAdvance || isProcessing}
                                    className={`w-full py-8 rounded-[2rem] font-black uppercase tracking-[0.5em] text-xs transition-all shadow-4xl active:scale-[0.98] flex items-center justify-center space-x-6 border-b-8 ${
                                        canAdvance 
                                        ? 'bg-white text-black border-zinc-300 hover:bg-cyan-50' 
                                        : 'bg-zinc-900 text-zinc-700 border-zinc-950 opacity-40 cursor-not-allowed'
                                    }`}
                                >
                                    {isProcessing ? <Loader className="w-6 h-6 animate-spin"/> : <Sparkles className="w-6 h-6 text-cyan-500"/>}
                                    <span>{activeActionIndex === tutorialReportForDutyMission.actions.length - 1 ? 'SEAL_AND_INITIALIZE_ACCOUNT' : 'SYNCHRONIZE_PHASE'}</span>
                                </button>
                                {canAdvance && (
                                    <p className="text-center mt-6 text-[9px] font-black text-cyan-500 uppercase tracking-widest animate-pulse">Link Stable: Data ready for commit.</p>
                                )}
                            </div>
                         </div>
                    </PanelShell>
                </main>
            </div>
        </div>
    </div>
  );
};

export default TutorialMissionView;

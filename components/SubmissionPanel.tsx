
import React, { useState, useMemo, useRef } from 'react';
import { Category, Report, SeverityLevel } from '../types';
import { 
  MapPin, Loader, Camera, ShieldCheck, Target, Zap, 
  FileText, CheckCircle, Clock, Play, Database, Broadcast, Sparkles, X
} from './icons';
import { FORM_BUNDLE, CATEGORIES_WITH_ICONS } from '../constants';

interface SubmissionPanelProps {
  addReport: (report: Omit<Report, 'id' | 'timestamp' | 'hash' | 'blockchainRef' | 'status'>, audioUrl?: string) => void;
  preselectedCategory?: Category;
  prefilledDescription?: string;
}

interface AttachedFile {
    file: File;
    preview: string | null;
    type: 'image' | 'video' | 'audio' | 'other';
}

const STEPS = [
  { id: 'DOMAIN', label: 'Domain', icon: <Target className="w-4 h-4"/> },
  { id: 'TEMPORAL', label: 'Sync', icon: <Clock className="w-4 h-4"/> },
  { id: 'FORENSIC', label: 'Data', icon: <FileText className="w-4 h-4"/> },
  { id: 'EVIDENCE', label: 'Intel', icon: <Camera className="w-4 h-4"/> },
  { id: 'SAFETY', label: 'Audit', icon: <ShieldCheck className="w-4 h-4"/> },
  { id: 'COMMIT', label: 'Seal', icon: <Database className="w-4 h-4"/> }
];

const ForensicField: React.FC<{ 
    question: any; 
    value: any; 
    onChange: (val: any) => void;
}> = ({ question, value, onChange }) => {
    const { label, help_text, answer_type, options } = question;
    const baseClass = "w-full bg-zinc-950 border-2 border-zinc-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold text-white outline-none focus:border-amber-500 transition-all placeholder:text-zinc-900 shadow-inner";
    const labelClass = "text-[10px] font-black tracking-[0.12em] sm:tracking-[0.35em] sm:uppercase text-zinc-400 ml-2";

    switch (answer_type) {
        case 'single_select':
            return (
                <div className="space-y-2 sm:space-y-3">
                    <label className={labelClass}>{label}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {options.map((opt: string) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => onChange(opt)}
                                className={`px-4 py-3 rounded-xl border-2 transition-all text-[9px] font-black uppercase text-left truncate ${value === opt ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-950 border-zinc-900 text-zinc-600 hover:border-zinc-700'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            );
        case 'multi_select':
            return (
                <div className="space-y-2 sm:space-y-3">
                    <label className={labelClass}>{label}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {options.map((opt: string) => {
                            const isSel = (value || []).includes(opt);
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        const current = value || [];
                                        onChange(isSel ? current.filter((v: any) => v !== opt) : [...current, opt]);
                                    }}
                                    className={`px-4 py-3 rounded-xl border-2 transition-all text-[9px] font-black uppercase text-left truncate ${isSel ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-zinc-950 border-zinc-900 text-zinc-600 hover:border-zinc-700'}`}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        case 'datetime':
            return (
                <div className="space-y-2 sm:space-y-3">
                    <label className={labelClass}>{label}</label>
                    <input type="datetime-local" value={value || ''} onChange={e => onChange(e.target.value)} className={baseClass} />
                </div>
            );
        case 'short_text':
            return (
                <div className="space-y-2 sm:space-y-3">
                    <label className={labelClass}>{label}</label>
                    <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className={baseClass} placeholder={help_text || "Input data..."} />
                </div>
            );
        default:
            return null;
    }
};

const SubmissionPanel: React.FC<SubmissionPanelProps> = ({ addReport, preselectedCategory, prefilledDescription }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [category, setCategory] = useState<Category | ''>(preselectedCategory || '');
  const [severity, setSeverity] = useState<SeverityLevel>('Standard');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState(prefilledDescription || '');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const schema = useMemo(() => {
    if (!category) return null;
    return FORM_BUNDLE.categories[category] || FORM_BUNDLE.categories['Other'];
  }, [category]);

  const fidelityScore = useMemo(() => {
    let score = 0;
    if (category) score += 10;
    if (location) score += 10;
    if (description.length > 50) score += 20;
    if (attachments.length > 0) score += 30;
    if (Object.keys(answers).length >= 3) score += 20;
    if (safetyConfirmed) score += 10;
    return score;
  }, [category, location, description, attachments, answers, safetyConfirmed]);

  const handleNext = () => {
    if (activeStepIndex < STEPS.length - 1) setActiveStepIndex(activeStepIndex + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (activeStepIndex > 0) setActiveStepIndex(activeStepIndex - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: AttachedFile[] = Array.from(files).map((file: File) => {
        let type: AttachedFile['type'] = 'other';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';
        return { file, preview: type === 'image' ? URL.createObjectURL(file) : null, type };
    });
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !safetyConfirmed) return;
    setIsSubmitting(true);
    addReport({
        title: `Forensic_Sync_${category.toUpperCase()}_${Date.now().toString().slice(-4)}`,
        description,
        category,
        location: location || 'GEO_STAMPED_NODE',
        trustScore: fidelityScore,
        severity,
        isActionable: fidelityScore > 70,
        attachments: attachments.map(a => a.file),
        structuredData: { ...answers, fidelity: fidelityScore, safety_checked: true }
    });
  };

  const renderStepContent = () => {
    switch (STEPS[activeStepIndex].id) {
      case 'DOMAIN':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tighter">Initialize_Reporting_Node</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Select the domain protocol for this artifact</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-h-[400px] sm:max-h-[300px] overflow-y-auto custom-scrollbar p-2">
              {CATEGORIES_WITH_ICONS.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => { setCategory(cat.value as Category); handleNext(); }}
                  className={`flex flex-col items-center justify-center p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border-2 transition-all ${category === cat.value ? 'bg-amber-600 border-amber-400 text-white shadow-2xl scale-105' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  <span className="text-3xl sm:text-4xl mb-3 sm:mb-4 grayscale group-hover:grayscale-0">{cat.icon}</span>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center leading-none">{cat.value}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'TEMPORAL':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
             <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tighter">Geospatial_Temporal_Anchor</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Define when and where the incident manifested</p>
            </div>
            <div className="space-y-4 sm:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                    <label className="text-[10px] font-black text-amber-500 tracking-[0.12em] sm:tracking-[0.35em] sm:uppercase ml-2">01. Sector_Identifier</label>
                    <div className="relative">
                        <MapPin className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 h-5 text-zinc-700" />
                        <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-zinc-950 border-2 border-zinc-800 pl-11 sm:pl-14 pr-4 sm:pr-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl outline-none focus:border-amber-500 text-white font-black uppercase tracking-widest text-xs sm:text-sm shadow-inner" placeholder="Address or Coordinates..." />
                    </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                    <label className="text-[10px] font-black text-amber-500 tracking-[0.12em] sm:tracking-[0.35em] sm:uppercase ml-2">02. Institutional_Triage</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['Informational', 'Standard', 'Critical', 'Catastrophic'].map(lvl => (
                            <button key={lvl} type="button" onClick={() => setSeverity(lvl as SeverityLevel)} className={`py-3 sm:py-4 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${severity === lvl ? 'bg-amber-600 border-amber-400 text-white shadow-lg' : 'bg-black border-zinc-900 text-zinc-600'}`}>{lvl}</button>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        );
      case 'FORENSIC':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tighter">Forensic_Data_Intake</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Protocol: SH-256 Structured Fact Verification</p>
            </div>
            <div className="space-y-4 sm:space-y-6 max-h-[450px] sm:max-h-[400px] overflow-y-auto custom-scrollbar pr-2 sm:pr-4">
               {schema?.core_questions.slice(0, 4).map((q: any) => (
                 <ForensicField key={q.id} question={q} value={answers[q.id]} onChange={v => setAnswers({...answers, [q.id]: v})} />
               ))}
               <div className="space-y-2 sm:space-y-3">
                   <label className="text-[10px] font-black text-amber-500 tracking-[0.12em] sm:tracking-[0.35em] sm:uppercase ml-2">Situational_Summary</label>
                   <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-zinc-950 border-2 border-zinc-800 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] text-sm font-bold text-white outline-none focus:border-amber-500 transition-all placeholder:text-zinc-900 min-h-[120px] resize-none leading-relaxed" placeholder="Summarize the core observation..." />
               </div>
            </div>
          </div>
        );
      case 'EVIDENCE':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tighter">Visual_Intel_Sync</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Attach telemetry shards to strengthen fidelity</p>
            </div>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="py-10 sm:py-16 border-2 border-dashed border-zinc-800 rounded-[2rem] sm:rounded-[3rem] bg-zinc-950 flex flex-col items-center justify-center space-y-4 sm:space-y-6 cursor-pointer hover:border-amber-500/50 hover:bg-zinc-900/50 transition-all group shadow-inner"
            >
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelection} accept="image/*,video/*,audio/*" />
              <div className="p-4 sm:p-6 bg-zinc-900 rounded-2xl sm:rounded-[2rem] border border-zinc-800 group-hover:border-amber-900 group-hover:scale-110 transition-all shadow-xl">
                  <Camera className="w-8 h-8 sm:w-12 h-12 text-zinc-700 group-hover:text-amber-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest group-hover:text-amber-100 transition-colors">Awaiting_Telemetry_Input</p>
                <p className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest mt-2">TAP TO UPLOAD PICTURES OR VIDEO</p>
              </div>
            </div>

            {attachments.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4 animate-fade-in">
                    {attachments.map((item, i) => (
                        <div key={i} className="relative aspect-square bg-zinc-950 border-2 border-zinc-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg group/item">
                            {item.type === 'image' ? (
                                <img src={item.preview!} alt="P" className="w-full h-full object-cover grayscale opacity-70 group-hover/item:grayscale-0 group-hover/item:opacity-100 transition-all" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 group-hover/item:text-amber-500 transition-colors">
                                    {item.type === 'video' ? <Play className="w-5 h-5 sm:w-6 h-6"/> : <FileText className="w-5 h-5 sm:w-6 h-6"/>}
                                </div>
                            )}
                            <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-black/80 rounded-lg text-rose-500 opacity-100 sm:opacity-0 group-hover/item:opacity-100 transition-opacity border border-rose-900/30">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </div>
        );
      case 'SAFETY':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tighter text-emerald-400">Operator_Safety_Protocol</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Final validation of field security status</p>
            </div>
            <div 
              onClick={() => setSafetyConfirmed(!safetyConfirmed)}
              className={`p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border-4 transition-all duration-300 cursor-pointer flex flex-col items-center space-y-4 sm:space-y-6 shadow-2xl relative overflow-hidden ${safetyConfirmed ? 'bg-emerald-950/20 border-emerald-500' : 'bg-zinc-950 border-zinc-800 border-dashed hover:border-zinc-700'}`}
            >
                <div className={`p-4 sm:p-6 rounded-full transition-all duration-500 ${safetyConfirmed ? 'bg-emerald-500 text-black shadow-[0_0_30px_emerald]' : 'bg-zinc-900 text-zinc-700'}`}>
                    <ShieldCheck className="w-10 h-10 sm:w-12 h-12" />
                </div>
                <div className="text-center space-y-2">
                    <p className="text-sm font-black text-white uppercase tracking-tighter">{safetyConfirmed ? 'Security_Verified' : 'Confirm_Field_Security'}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase leading-relaxed max-w-[30ch]">I verify that I have maintained a safe distance and avoided conflict.</p>
                </div>
                {safetyConfirmed && <div className="absolute top-4 right-4 text-emerald-500 animate-pulse"><Sparkles className="w-5 h-5 sm:w-6 h-6"/></div>}
            </div>
          </div>
        );
      case 'COMMIT':
        return (
          <div className="space-y-6 sm:space-y-10 animate-fade-in pb-8">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tighter">Ledger_Review</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Review forensic metadata before cryptographic sealing</p>
            </div>

            <div className="bg-zinc-900 border-2 border-zinc-800 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Broadcast className="w-16 h-16 sm:w-20 h-20 text-amber-500"/></div>
                <div className="grid grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Protocol</p>
                        <p className="text-xs sm:text-sm font-black text-white uppercase truncate">{category || 'UNDETERMINED'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Geospatial</p>
                        <p className="text-xs sm:text-sm font-black text-white uppercase truncate">{location || 'GEO_PENDING'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Temporal</p>
                        <p className="text-xs sm:text-sm font-black text-white uppercase">SYSTEM_LOCKED</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Evidence</p>
                        <p className="text-xs sm:text-sm font-black text-emerald-500 uppercase">{attachments.length} Shards</p>
                    </div>
                </div>
                <div className="pt-4 sm:pt-6 border-t border-zinc-800">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-2">Narrative_Hash</p>
                    <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed line-clamp-2 italic">"{description}"</p>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-6 sm:py-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-3xl transition-all active:scale-95 flex items-center justify-center space-x-4 border-b-8 border-amber-800 group"
            >
                {isSubmitting ? (
                    <><Loader className="w-6 h-6 sm:w-8 h-8 animate-spin"/><span className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.4em]">Sealing_Shard...</span></>
                ) : (
                    <><Database className="w-6 h-6 sm:w-8 h-8 group-hover:scale-110 transition-transform"/><span className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.4em]">Finalize_Ledger_Commit</span></>
                )}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="font-mono w-full flex flex-col lg:flex-row gap-8 sm:gap-12 pb-24 md:pb-32">
      {/* TIMELINE SIDEBAR / HEADER */}
      <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] lg:sticky lg:top-32 space-y-4 sm:space-y-10 shadow-2xl">
              <div className="flex lg:flex-col justify-between items-center lg:items-start lg:space-y-2 mb-2 lg:mb-8">
                  <div>
                    <p className="text-[8px] sm:text-[9px] font-black text-zinc-600 uppercase tracking-widest">Shard_Fidelity</p>
                    <div className="flex items-end gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-4xl font-black tracking-tighter text-white">{fidelityScore}%</span>
                        <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full mb-1 sm:mb-2 ${fidelityScore > 70 ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-amber-500'}`}></div>
                    </div>
                  </div>
                  <div className="h-1 w-24 sm:w-full bg-zinc-950 rounded-full overflow-hidden mt-1 sm:mt-0">
                      <div className="h-full bg-amber-500 shadow-[0_0_15px_amber] transition-all duration-1000" style={{ width: `${fidelityScore}%` }}></div>
                  </div>
              </div>

              <div className="hidden lg:block space-y-8 relative">
                  <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-zinc-800"></div>
                  {STEPS.map((step, idx) => {
                      const isActive = activeStepIndex === idx;
                      const isComplete = activeStepIndex > idx;
                      return (
                          <div key={step.id} className={`relative flex items-center space-x-6 transition-all duration-500 ${idx > activeStepIndex ? 'opacity-20' : 'opacity-100'}`}>
                              <div className={`relative z-10 w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all ${isComplete ? 'bg-emerald-500 border-emerald-400 text-black' : isActive ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                                  {isComplete ? <CheckCircle className="w-5 h-5" /> : step.icon}
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-zinc-500'}`}>{step.label}</span>
                          </div>
                      );
                  })}
              </div>

              {/* Mobile Step Indicator */}
              <div className="lg:hidden flex items-center justify-between text-[10px] font-black uppercase text-zinc-500 tracking-widest px-1">
                  <span>Block {activeStepIndex + 1} of {STEPS.length}</span>
                  <span className="text-amber-500">{STEPS[activeStepIndex].label}</span>
              </div>
          </div>
      </aside>

      {/* CONTENT AREA */}
      <div className="flex-grow">
          <form onSubmit={handleSubmit} className="bg-zinc-900/40 border-2 border-zinc-800 rounded-[2rem] sm:rounded-[4rem] p-6 sm:p-16 shadow-4xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
                  <div className="h-full bg-amber-600 transition-all duration-1000" style={{ width: `${((activeStepIndex + 1) / STEPS.length) * 100}%` }}></div>
              </div>
              
              <div className="min-h-[400px] sm:min-h-[500px] flex flex-col justify-center">
                  {renderStepContent()}
              </div>

              {/* Action Buttons - Repositioned inline for all views */}
              <div className="flex mt-12 pt-10 border-t border-zinc-800/50 justify-between gap-4">
                    <button 
                      type="button" 
                      onClick={handlePrev} 
                      disabled={activeStepIndex === 0} 
                      className="flex-1 sm:flex-none px-10 py-4 bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-10"
                    >
                      Back
                    </button>
                    {activeStepIndex < STEPS.length - 1 && (
                      <button 
                        type="button" 
                        onClick={handleNext} 
                        className="flex-1 sm:flex-none px-10 py-4 bg-white sm:bg-zinc-900 border border-zinc-300 sm:border-zinc-700 text-black sm:text-amber-400 hover:bg-zinc-800 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl sm:shadow-none"
                      >
                        Next_Phase
                      </button>
                    )}
              </div>
          </form>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .animate-scan-y { animation: scanY 3s linear infinite; }
        @keyframes scanY { 0% { top: 0; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      `}</style>
    </div>
  );
};

export default SubmissionPanel;

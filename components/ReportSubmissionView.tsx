
import React from 'react';
import { Category, Report, EducationRole } from '../types';
import { CATEGORIES_WITH_ICONS, EDUCATION_ROLES } from '../constants';
import SubmissionPanel from './SubmissionPanel';
import { ArrowLeft, ShieldCheck, Database } from './icons';
import { useTranslations } from '../i18n';

interface ReportSubmissionViewProps {
    category: Category;
    role: EducationRole | null;
    onReturn: () => void;
    addReport: (report: Omit<Report, 'id' | 'timestamp' | 'hash' | 'blockchainRef' | 'status'>) => void;
    totalReports: number;
    prefilledDescription?: string;
}

const ReportSubmissionView: React.FC<ReportSubmissionViewProps> = ({ category, role, onReturn, addReport, totalReports, prefilledDescription }) => {
    const { t } = useTranslations();
    const categoryInfo = CATEGORIES_WITH_ICONS.find(c => c.value === category)!;
    const roleInfo = role ? EDUCATION_ROLES.find(r => r.value === role) : null;
    const imageUrl = `https://picsum.photos/seed/${categoryInfo.imageSeed}/1200/400`;

    return (
        <div className="animate-fade-in font-mono text-white max-w-7xl mx-auto pb-32 px-4">
             <style>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .dispatch-gradient { background: linear-gradient(180deg, rgba(13, 13, 26, 0) 0%, rgba(13, 13, 26, 0.8) 100%); }
                .scanline-overlay {
                    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
                    background-size: 100% 4px, 3px 100%;
                    pointer-events: none;
                }
            `}</style>
            
            {/* Immersive Header - Optimized for Mobile Padding */}
            <div className="relative h-[11rem] sm:h-[13rem] md:h-[18rem] rounded-[1.75rem] sm:rounded-[2.5rem] overflow-hidden mb-6 sm:mb-12 border-2 border-zinc-800 shadow-4xl group">
                <div 
                    className="absolute inset-0 bg-cover bg-center grayscale contrast-125 brightness-50 transition-all duration-1000 group-hover:scale-105"
                    style={{ backgroundImage: `url(${imageUrl})` }}
                ></div>
                <div className="absolute inset-0 bg-zinc-600/10 mix-blend-color opacity-30"></div>
                <div className="absolute inset-0 scanline-overlay"></div>
                <div className="absolute inset-0 dispatch-gradient"></div>
                
                <div className="relative h-full flex flex-col justify-between p-4 sm:p-10 md:p-16">
                    <button
                        onClick={onReturn}
                        className="flex items-center space-x-2 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-amber-400 hover:text-amber-300 transition-colors group bg-black/60 w-fit px-4 sm:px-8 py-1.5 sm:py-2 rounded-full border border-amber-500/20 backdrop-blur-md"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-2" />
                        <span>PROTOCOL_RESET</span>
                    </button>

                    <div className="flex items-end space-x-4 sm:space-x-10">
                        <div className="p-3 sm:p-6 bg-zinc-950/60 border-2 border-amber-500/40 rounded-2xl sm:rounded-[2.5rem] text-4xl sm:text-6xl shadow-[0_0_60px_rgba(245,158,11,0.2)] flex-shrink-0 backdrop-blur-xl transition-transform group-hover:scale-110 duration-700">
                            {categoryInfo.icon}
                        </div>
                        <div className="pb-1 sm:pb-2 min-w-0">
                            <h2 className="text-[8px] sm:text-xs font-black uppercase tracking-[0.3em] sm:tracking-[0.6em] text-amber-500 mb-1 sm:mb-3">Forensic_Intake</h2>
                            <p className="text-xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl truncate">
                                {categoryInfo.headline}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Redesigned Submission Flow */}
            <SubmissionPanel 
                addReport={addReport} 
                preselectedCategory={category} 
                prefilledDescription={prefilledDescription} 
            />

            {/* Bottom Metadata Shards - Simplified on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mt-8 sm:mt-12 no-print">
                <div className="bg-zinc-900/60 border-2 border-zinc-800 p-6 sm:p-8 rounded-[1.75rem] sm:rounded-[3rem] shadow-xl backdrop-blur-sm flex items-center justify-between group">
                    <div className="flex items-center space-x-4 sm:space-x-8">
                        <div className="w-12 h-12 sm:w-20 sm:h-20 bg-zinc-950 rounded-xl sm:rounded-[2rem] flex items-center justify-center text-2xl sm:text-5xl border-2 border-zinc-800 flex-shrink-0 shadow-inner group-hover:border-amber-500/30 transition-colors">
                            {roleInfo?.icon || '🛡️'}
                        </div>
                        <div>
                            <p className="text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest">Authorized_Role</p>
                            <p className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight">{roleInfo ? t(roleInfo.translationKey) : 'Citizen'}</p>
                        </div>
                    </div>
                    <ShieldCheck className="w-8 h-8 sm:w-12 sm:h-12 text-emerald-500/20 group-hover:text-emerald-500/50 transition-colors" />
                </div>

                <div className="bg-zinc-950 border-2 border-zinc-900 p-6 sm:p-8 rounded-[1.75rem] sm:rounded-[3rem] shadow-inner flex items-center justify-between group">
                    <div className="flex items-end space-x-6 sm:space-x-10">
                        <div className="min-w-0">
                            <h3 className="text-[8px] sm:text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] sm:tracking-[0.4em] mb-1 sm:mb-3">Ledger_Volume</h3>
                            <div className="flex items-end space-x-3 sm:space-x-4">
                                <span className="text-3xl sm:text-6xl font-black text-white tracking-tighter leading-none">{totalReports.toLocaleString()}</span>
                                <span className="text-[8px] sm:text-[10px] font-black text-zinc-800 uppercase tracking-widest mb-1 group-hover:text-amber-900 transition-colors">Shards</span>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col space-y-2">
                            <div className="flex items-center space-x-3 text-emerald-500 text-[10px] font-black">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_emerald]"></div>
                                <span className="tracking-[0.2em]">P2P_SYNC_READY</span>
                            </div>
                        </div>
                    </div>
                    <Database className="w-8 h-8 sm:w-12 sm:h-12 text-zinc-900 group-hover:text-amber-900 transition-colors" />
                </div>
            </div>
        </div>
    );
};

export default ReportSubmissionView;

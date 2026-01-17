
import React, { useEffect, useState, useRef } from 'react';
import { TutorialOverlayStep } from '../types';
import { ChevronRight, X } from './icons';

interface TutorialOverlayProps {
    step: TutorialOverlayStep;
    onNext: () => void;
    onSkip: () => void;
    isLastStep: boolean;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ step, onNext, onSkip, isLastStep }) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateRect = () => {
            const el = document.querySelector(step.targetSelector);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
            } else {
                setTargetRect(null);
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
        };
    }, [step.targetSelector]);

    const getCardStyle = () => {
        if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

        const margin = 16;
        let top = 0;
        let left = 0;

        switch (step.placement) {
            case 'top':
                top = targetRect.top - margin;
                left = targetRect.left + targetRect.width / 2;
                return { top, left, transform: 'translate(-50%, -100%)' };
            case 'bottom':
                top = targetRect.bottom + margin;
                left = targetRect.left + targetRect.width / 2;
                return { top, left, transform: 'translate(-50%, 0)' };
            case 'left':
                top = targetRect.top + targetRect.height / 2;
                left = targetRect.left - margin;
                return { top, left, transform: 'translate(-100%, -50%)' };
            case 'right':
                top = targetRect.top + targetRect.height / 2;
                left = targetRect.right + margin;
                return { top, left, transform: 'translate(0, -50%)' };
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] pointer-events-none font-mono">
            {/* Dark Overlay with Hole */}
            <div className="absolute inset-0 bg-black/70 transition-all duration-500 pointer-events-auto" style={{
                clipPath: targetRect ? `polygon(
                    0% 0%, 
                    0% 100%, 
                    ${targetRect.left}px 100%, 
                    ${targetRect.left}px ${targetRect.top}px, 
                    ${targetRect.right}px ${targetRect.top}px, 
                    ${targetRect.right}px ${targetRect.bottom}px, 
                    ${targetRect.left}px ${targetRect.bottom}px, 
                    ${targetRect.left}px 100%, 
                    100% 100%, 
                    100% 0%
                )` : 'none'
            }} />

            {/* Tooltip Card */}
            <div 
                ref={cardRef}
                style={getCardStyle()}
                className="absolute w-72 bg-zinc-900 border-2 border-cyan-500 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.3)] transition-all duration-500 pointer-events-auto animate-fade-in"
            >
                <div className="space-y-4">
                    <div className="flex justify-between items-start">
                        <h4 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{step.title}</h4>
                        <button onClick={onSkip} className="text-zinc-600 hover:text-rose-500 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-zinc-300 font-bold leading-relaxed uppercase">
                        {step.body}
                    </p>
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={onSkip} className="text-[9px] font-black text-zinc-600 hover:text-zinc-400 uppercase tracking-widest">
                            Skip Mission
                        </button>
                        <button 
                            onClick={onNext}
                            className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                        >
                            <span>{isLastStep ? 'FINALIZE' : 'NEXT'}</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.9) translate(-50%, -50%); } to { opacity: 1; transform: scale(1) translate(-50%, -50%); } }
                /* Override card specific transform logic for non-centered cases */
                .animate-fade-in[style*="transform: translate(-50%, -100%)"] { animation: fadeInTop 0.4s ease-out forwards; }
                .animate-fade-in[style*="transform: translate(-50%, 0)"] { animation: fadeInBottom 0.4s ease-out forwards; }
                .animate-fade-in[style*="transform: translate(-100%, -50%)"] { animation: fadeInLeft 0.4s ease-out forwards; }
                .animate-fade-in[style*="transform: translate(0, -50%)"] { animation: fadeInRight 0.4s ease-out forwards; }

                @keyframes fadeInTop { from { opacity: 0; transform: translate(-50%, -90%); } to { opacity: 1; transform: translate(-50%, -100%); } }
                @keyframes fadeInBottom { from { opacity: 0; transform: translate(-50%, -10%); } to { opacity: 1; transform: translate(-50%, 0); } }
                @keyframes fadeInLeft { from { opacity: 0; transform: translate(-90%, -50%); } to { opacity: 1; transform: translate(-100%, -50%); } }
                @keyframes fadeInRight { from { opacity: 0; transform: translate(-10%, -50%); } to { opacity: 1; transform: translate(0, -50%); } }
            `}</style>
        </div>
    );
};

export default TutorialOverlay;

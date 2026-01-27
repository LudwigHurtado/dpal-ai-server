
import React, { useRef, useEffect, useState } from 'react';
import { type Report, type CharacterNft } from '../types';
import { useTranslations } from '../i18n';
import { CATEGORIES_WITH_ICONS } from '../constants';
import { QrCode, Gem } from './icons';
import QrCodeDisplay from './QrCodeDisplay';

interface NftCardProps {
  report?: Report;
  characterNft?: CharacterNft;
}

const NftCard: React.FC<NftCardProps> = ({ report, characterNft }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [showQr, setShowQr] = useState(false);
    const { t } = useTranslations();
    // Get API base URL - Vite exposes env vars at build time
    const envApiBase = (import.meta as any).env?.VITE_API_BASE;
    const apiBase = envApiBase || 'https://web-production-a27b.up.railway.app';
    
    const nft = report?.earnedNft;
    const isCharacter = !!characterNft;
    const displayData = isCharacter ? characterNft : nft;

    // Normalize image URL so relative paths like \"/api/assets/...\" load from
    // the backend API base instead of the Vercel frontend origin.
    // FIX: Force all URLs to use our Railway backend, regardless of what's stored
    const resolvedImageUrl = displayData?.imageUrl
        ? (() => {
            let url = String(displayData.imageUrl).trim();
            
            // CRITICAL FIX: If URL contains api.dpal.net, extract tokenId and rebuild
            if (url.includes('api.dpal.net')) {
                // Extract tokenId from URL (e.g., DPAL-1769527702858-dd12cf3cd8cb1066)
                const tokenIdMatch = url.match(/DPAL-[^\/\.]+/);
                if (tokenIdMatch) {
                    url = `/api/assets/${tokenIdMatch[0]}.png`;
                } else {
                    // Fallback: try to extract from path
                    url = url.replace(/https?:\/\/[^\/]+/, '').replace('/v1/assets/', '/api/assets/');
                }
            }
            // Fix: Replace /v1/assets/ with /api/assets/
            else if (url.includes('/v1/assets/')) {
                url = url.replace('/v1/assets/', '/api/assets/');
            }
            // If it's a full URL pointing to wrong domain, extract path
            else if (url.startsWith('http') && !url.includes('web-production-a27b.up.railway.app') && !url.includes(apiBase.replace('https://', '').replace('http://', ''))) {
                try {
                    const urlObj = new URL(url);
                    url = urlObj.pathname;
                    // Ensure /api/assets/ path
                    if (url.includes('/v1/assets/')) {
                        url = url.replace('/v1/assets/', '/api/assets/');
                    }
                } catch {
                    // If URL parsing fails, extract tokenId and rebuild
                    const tokenIdMatch = url.match(/DPAL-[^\/\.]+/);
                    if (tokenIdMatch) {
                        url = `/api/assets/${tokenIdMatch[0]}.png`;
                    } else {
                        url = url.replace(/https?:\/\/[^\/]+/, '');
                    }
                }
            }
            // If it's already pointing to our backend, use as-is
            else if (url.startsWith('http') && (url.includes('web-production-a27b.up.railway.app') || url.includes(apiBase.replace('https://', '').replace('http://', '')))) {
                return url; // Already correct
            }
            
            // Ensure it starts with /api/assets/ (not /v1/assets/)
            if (!url.startsWith('/api/assets/')) {
                // Try to extract tokenId and rebuild URL
                const tokenIdMatch = url.match(/DPAL-[^\/\.]+/);
                if (tokenIdMatch) {
                    url = `/api/assets/${tokenIdMatch[0]}.png`;
                } else if (url.startsWith('/')) {
                    // Already a path, just ensure it's /api/assets/
                    if (url.includes('assets')) {
                        url = url.replace(/\/v1\/assets\//, '/api/assets/').replace(/\/assets\//, '/api/assets/');
                    }
                }
            }
            
            // Prepend apiBase to relative paths
            const finalUrl = url.startsWith('/') ? `${apiBase}${url}` : `${apiBase}/${url}`;
            
            // Final safety check: if somehow we still have api.dpal.net, force rebuild
            if (finalUrl.includes('api.dpal.net')) {
                const tokenIdMatch = finalUrl.match(/DPAL-[^\/\.]+/);
                if (tokenIdMatch) {
                    return `${apiBase}/api/assets/${tokenIdMatch[0]}.png`;
                }
            }
            
            return finalUrl;
        })()
        : '';

    // Debug: Log URL resolution to help diagnose issues
    useEffect(() => {
        if (displayData?.imageUrl && !isCharacter) {
            console.log('🖼️ NftCard Image URL Debug:', {
                originalUrl: displayData.imageUrl,
                envVar: envApiBase || '(NOT SET - using fallback)',
                apiBase: apiBase,
                resolvedUrl: resolvedImageUrl,
                warning: !envApiBase ? '⚠️ VITE_API_BASE not set in Vercel! Using fallback.' : '✅ Using VITE_API_BASE from env'
            });
        }
    }, [displayData?.imageUrl, apiBase, resolvedImageUrl, envApiBase, isCharacter]);

    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const handleMouseMove = (e: MouseEvent) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        };
        card.addEventListener('mousemove', handleMouseMove);
        return () => card.removeEventListener('mousemove', handleMouseMove);
    }, []);

    if (!displayData) return null;

    if (isCharacter) {
        return (
            <div ref={cardRef} className="nft-card-container group relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-gray-800 shadow-2xl transition-transform duration-300 hover:scale-105 p-2 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700">
                <div className="relative w-full h-full rounded-lg overflow-hidden">
                    <img src={resolvedImageUrl} alt={displayData.title} className="w-full h-full object-cover aspect-[4/5]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="font-bold text-xl leading-tight drop-shadow-lg">{displayData.title}</h3>
                        <p className="text-sm text-gray-300 drop-shadow-md">{characterNft.collection}</p>
                    </div>
                </div>
                 <style>{`
                    .nft-card-container { --mouse-x: 50%; --mouse-y: 50%; }
                    .nft-card-container::before {
                        content: ''; position: absolute; left: 0; right: 0; top: 0; bottom: 0;
                        background: radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(0, 255, 255, 0.2), transparent 40%);
                        border-radius: inherit; opacity: 0; transition: opacity 0.5s; z-index: 2; pointer-events: none;
                    }
                    .nft-card-container:hover::before { opacity: 1; }
                `}</style>
            </div>
        );
    }
    
    const categoryInfo = report ? CATEGORIES_WITH_ICONS.find(c => c.value === (nft?.mintCategory || report.category)) : null;
    const categoryName = categoryInfo ? t(categoryInfo.translationKey) : (nft?.mintCategory || report?.category);

    const [imageError, setImageError] = useState(false);

    return (
        <div ref={cardRef} className="nft-card-container group relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-gray-800 shadow-2xl transition-transform duration-300 hover:scale-105 p-2 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700">
            <div className="relative w-full h-full rounded-lg overflow-hidden bg-black">
                {!imageError && resolvedImageUrl ? (
                    <img 
                        src={resolvedImageUrl} 
                        alt={displayData.title} 
                        className="w-full h-full object-cover aspect-[4/5]" 
                        onError={() => {
                            console.error('NFT image failed to load:', resolvedImageUrl);
                            setImageError(true);
                        }}
                    />
                ) : (
                    <div className="w-full h-full aspect-[4/5] flex items-center justify-center bg-gradient-to-br from-amber-900/20 to-amber-700/20">
                        <div className="text-center p-8">
                            <Gem className="w-16 h-16 text-amber-500/50 mx-auto mb-4" />
                            <p className="text-xs text-amber-400/70 font-mono uppercase tracking-wider">
                                {imageError ? 'Image unavailable' : 'Loading...'}
                            </p>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none"></div>

                <div className="absolute top-0 left-0 right-0 p-3 bg-black/40 backdrop-blur-sm flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        {categoryInfo && <span className="text-xl">{categoryInfo.icon}</span>}
                        <h3 className="font-bold text-lg text-white uppercase tracking-wider drop-shadow-lg">{categoryName}</h3>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setShowQr(true); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors" title="Prove Authenticity">
                        <QrCode className="w-5 h-5 text-cyan-400" />
                    </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <div className="bg-black/40 backdrop-blur-sm rounded-md p-2 text-xs font-mono">
                        <div className="flex justify-between text-gray-300">
                            <span>Block #</span>
                            <span className="text-white">#{nft?.blockNumber ?? 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                            <span>Tx Hash</span>
                            <span className="text-white truncate">{nft?.txHash ? `${nft.txHash.substring(0, 10)}...` : 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
            {showQr && report && <QrCodeDisplay type="report" id={report.id} onClose={() => setShowQr(false)} />}
            <style>{`
                .nft-card-container { --mouse-x: 50%; --mouse-y: 50%; }
                .nft-card-container::before {
                    content: ''; position: absolute; left: 0; right: 0; top: 0; bottom: 0;
                    background: radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(0, 255, 255, 0.2), transparent 40%);
                    border-radius: inherit; opacity: 0; transition: opacity 0.5s; z-index: 2; pointer-events: none;
                }
                .nft-card-container:hover::before { opacity: 1; }
            `}</style>
        </div>
    );
};

export default NftCard;


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

    // Normalize image URL - FORCE all URLs to use Railway backend
    // This handles api.dpal.net, /v1/assets/, and any other wrong URLs
    const resolvedImageUrl = displayData?.imageUrl
        ? (() => {
            const originalUrl = String(displayData.imageUrl).trim();
            
            // ALWAYS extract tokenId first - this is the most reliable approach
            const tokenIdMatch = originalUrl.match(/DPAL-[^\/\.\?]+/);
            
            if (tokenIdMatch) {
                // We found a tokenId - rebuild URL correctly
                const tokenId = tokenIdMatch[0];
                const correctUrl = `${apiBase}/api/assets/${tokenId}.png`;
                
                console.log('🔧 NftCard URL Fix:', {
                    original: originalUrl,
                    tokenId: tokenId,
                    fixed: correctUrl
                });
                
                return correctUrl;
            }
            
            // Fallback: if no tokenId found, try to fix the path
            let url = originalUrl;
            
            // Remove any domain (api.dpal.net, etc.)
            if (url.includes('://')) {
                url = url.replace(/https?:\/\/[^\/]+/, '');
            }
            
            // Fix /v1/assets/ to /api/assets/
            url = url.replace(/\/v1\/assets\//, '/api/assets/');
            
            // Ensure it starts with /api/assets/
            if (!url.startsWith('/api/assets/')) {
                // Try to find assets path
                const assetsMatch = url.match(/\/assets\/([^\/\?]+)/);
                if (assetsMatch) {
                    url = `/api/assets/${assetsMatch[1]}`;
                } else {
                    // Last resort: use original but prepend apiBase
                    url = url.startsWith('/') ? url : `/${url}`;
                }
            }
            
            return `${apiBase}${url}`;
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
    
    // CRITICAL: Initialize finalImageUrl immediately (not in useEffect) to prevent wrong URL from rendering
    const getFinalImageUrl = (): string => {
        if (!displayData?.imageUrl || isCharacter) {
            return resolvedImageUrl;
        }
        
        const original = String(displayData.imageUrl).trim();
        
        // Extract tokenId - this is the most reliable way
        const tokenIdMatch = original.match(/DPAL-[^\/\.\?]+/);
        
        if (tokenIdMatch) {
            const tokenId = tokenIdMatch[0];
            const correct = `${apiBase}/api/assets/${tokenId}.png`;
            
            // Log if we're fixing a bad URL
            if (original.includes('api.dpal.net') || original.includes('/v1/assets/')) {
                console.log('🔧 NftCard: FIXING bad URL', {
                    original,
                    tokenId,
                    correct
                });
            }
            
            return correct;
        }
        
        return resolvedImageUrl;
    };
    
    const finalImageUrl = getFinalImageUrl();

    return (
        <div ref={cardRef} className="nft-card-container group relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-gray-800 shadow-2xl transition-transform duration-300 hover:scale-105 p-2 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700">
            <div className="relative w-full h-full rounded-lg overflow-hidden bg-black">
                {!imageError && finalImageUrl ? (
                    <img 
                        src={finalImageUrl} 
                        alt={displayData.title} 
                        className="w-full h-full object-cover aspect-[4/5]" 
                        onError={() => {
                            console.error('❌ NFT image failed to load:', finalImageUrl);
                            setImageError(true);
                        }}
                        onLoad={() => {
                            console.log('✅ NFT image loaded successfully:', finalImageUrl);
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

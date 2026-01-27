import React, { useMemo, useState, useEffect } from 'react';
import type { Report, CharacterNft, Hero, Category, NftRarity } from '../types';
import { useTranslations } from '../i18n';
import NftCard from './NftCard';
import { ArrowLeft, Award, Coins, Gem } from './icons';
import { LEGENDS_OF_THE_LEDGER_NFTS } from '../constants';
import { getNftReceipts } from '../services/api';

interface CollectionCodexProps {
  reports: Report[];
  hero: Hero;
  onReturn: () => void;
}

const CollectionCodex: React.FC<CollectionCodexProps> = ({ reports, hero, onReturn }) => {
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<'rewards' | 'badges' | 'legends'>('rewards');
  const [backendNfts, setBackendNfts] = useState<Report[]>([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);

  // Fetch NFTs from backend API
  useEffect(() => {
    const fetchBackendNfts = async () => {
      // Use operativeId or fallback to 'default' for testing
      const userId = hero.operativeId || 'default';
      console.log('🔍 CollectionCodex: Fetching NFTs for userId:', userId);
      
      setIsLoadingBackend(true);
      try {
        const receipts = await getNftReceipts(userId);
        console.log('✅ CollectionCodex: Received receipts:', receipts.length, receipts);
        
        // Convert receipts to Report format for display
        const nftReports: Report[] = receipts.map((receipt) => ({
          id: `nft-${receipt.tokenId}`,
          title: `MINTED NFT`,
          description: `NFT artifact. Token ID: ${receipt.tokenId}`,
          category: 'Other' as Category,
          location: 'DPAL Network',
          timestamp: new Date(receipt.createdAt || receipt.mintedAt || Date.now()),
          hash: receipt.txHash,
          blockchainRef: receipt.txHash,
          isAuthor: true,
          status: 'Submitted',
          trustScore: 100,
          severity: 'Informational',
          isActionable: false,
          imageUrls: [`/api/assets/${receipt.tokenId}.png`],
          earnedNft: {
            source: 'minted',
            title: `NFT ${receipt.tokenId}`,
            imageUrl: `/api/assets/${receipt.tokenId}.png`,
            mintCategory: 'Other' as Category,
            blockNumber: 0,
            txHash: receipt.txHash,
            rarity: 'Rare' as NftRarity,
            grade: 'A',
          },
        }));
        console.log('✅ CollectionCodex: Converted to reports:', nftReports.length);
        setBackendNfts(nftReports);
      } catch (error: any) {
        console.error('❌ CollectionCodex: Failed to fetch backend NFTs:', error);
        console.error('Error details:', error?.message, error?.response, error?.stack);
      } finally {
        setIsLoadingBackend(false);
      }
    };

    fetchBackendNfts();
  }, [hero.operativeId]);

  // Merge local reports with backend NFTs (backend takes precedence for duplicates)
  const allReports = useMemo(() => {
    const backendIds = new Set(backendNfts.map(r => r.id));
    const localOnly = reports.filter(r => !backendIds.has(r.id));
    return [...backendNfts, ...localOnly];
  }, [reports, backendNfts]);

  const earnedNfts = useMemo(
    () =>
      allReports
        .filter(
          (r) =>
            r.isAuthor &&
            r.earnedNft &&
            (r.earnedNft.source === 'report' || r.earnedNft.source === 'minted')
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [allReports]
  );

  const badgeNfts = useMemo(
    () =>
      reports
        .filter((r) => r.isAuthor && r.earnedNft && r.earnedNft.source === 'badge')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [reports]
  );

  return (
    <div className="animate-fade-in">
      <button
        onClick={onReturn}
        className="inline-flex items-center space-x-2 text-sm font-semibold text-skin-muted hover:text-skin-base transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t('collectionCodex.returnToHeroHub')}</span>
      </button>

      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-skin-base tracking-tight">
          {t('collectionCodex.title')}
        </h1>
        <p className="mt-2 text-lg text-skin-muted">{t('collectionCodex.subtitle')}</p>
      </header>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
        <div className="bg-skin-panel border border-skin-panel p-4 rounded-lg flex items-center space-x-3">
          <div className="p-2 bg-yellow-500/10 rounded-full">
            <Coins className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-skin-muted">{t('heroHub.heroCredits')}</p>
            <p className="text-xl font-bold text-skin-base">{hero.heroCredits.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-skin-panel border border-skin-panel p-4 rounded-lg flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 rounded-full">
            <Gem className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-skin-muted">{t('heroHub.legendTokens')}</p>
            <p className="text-xl font-bold text-skin-base">{hero.legendTokens.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 border-b border-skin-panel flex justify-center">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('rewards')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'rewards'
                ? 'border-skin-primary text-skin-primary'
                : 'border-transparent text-skin-muted hover:text-skin-base hover:border-gray-600'
            }`}
          >
            {t('collectionCodex.tabs.rewards')}
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'badges'
                ? 'border-skin-primary text-skin-primary'
                : 'border-transparent text-skin-muted hover:text-skin-base hover:border-gray-600'
            }`}
          >
            {t('collectionCodex.tabs.badges')}
          </button>
          <button
            onClick={() => setActiveTab('legends')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'legends'
                ? 'border-skin-primary text-skin-primary'
                : 'border-transparent text-skin-muted hover:text-skin-base hover:border-gray-600'
            }`}
          >
            {t('collectionCodex.tabs.legends')}
          </button>
        </nav>
      </div>

      {activeTab === 'rewards' && (
        isLoadingBackend ? (
          <div className="text-center text-skin-muted py-20 bg-skin-panel border border-skin-panel rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-skin-primary mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-skin-base">Loading NFTs...</h3>
            <p className="mt-2 max-w-sm mx-auto">Fetching from backend...</p>
          </div>
        ) : earnedNfts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {earnedNfts.map((report) => (
              <NftCard key={report.id} report={report} />
            ))}
          </div>
        ) : (
          <div className="text-center text-skin-muted py-20 bg-skin-panel border border-skin-panel rounded-lg">
            <Award className="w-20 h-20 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-skin-base">{t('collectionCodex.noNftsTitle')}</h3>
            <p className="mt-2 max-w-sm mx-auto">{t('collectionCodex.noNftsSubtitle')}</p>
            <p className="mt-4 text-xs text-skin-muted">
              Debug: userId={hero.operativeId || 'default'}, backendNfts={backendNfts.length}, localReports={reports.filter(r => r.earnedNft).length}
            </p>
          </div>
        )
      )}

      {activeTab === 'badges' && (
        badgeNfts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {badgeNfts.map((report) => (
              <NftCard key={report.id} report={report} />
            ))}
          </div>
        ) : (
          <div className="text-center text-skin-muted py-20 bg-skin-panel border border-skin-panel rounded-lg">
            <Award className="w-20 h-20 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-skin-base">{t('collectionCodex.noBadgesTitle')}</h3>
            <p className="mt-2 max-w-sm mx-auto">{t('collectionCodex.noBadgesSubtitle')}</p>
          </div>
        )
      )}

      {activeTab === 'legends' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {LEGENDS_OF_THE_LEDGER_NFTS.map((nft, idx) => (
            <NftCard key={nft.title || `legend-${idx}`} characterNft={nft} />
          ))}
        </div>
      )}

      <style>{`
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CollectionCodex;
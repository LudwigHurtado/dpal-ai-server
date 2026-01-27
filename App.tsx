
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import FilterPanel from './components/FilterPanel';
import MainContentPanel from './components/MainContentPanel';
import HeroHub from './components/HeroHub';
import MainMenu from './components/MainMenu';
import CategorySelectionView from './components/CategorySelectionView';
import ReportSubmissionView from './components/ReportSubmissionView';
import ReportCompleteView from './components/ReportCompleteView';
import ReputationAndCurrencyView from './components/ReputationAndCurrencyView';
import PaymentView from './components/PaymentView';
import MissionDetailView from './components/MissionDetailView';
import MissionCompleteView from './components/MissionCompleteView';
import LiveIntelligenceView from './components/LiveIntelligenceView';
import GenerateMissionView from './components/GenerateMissionView';
import TrainingHolodeckView from './components/TrainingHolodeckView';
import TacticalVault from './components/TacticalVault';
import TransparencyDatabaseView from './components/TransparencyDatabaseView';
import AiRegulationHub from './components/AiRegulationHub';
import IncidentRoomView from './components/IncidentRoomView';
import TacticalHeatmap from './components/TacticalHeatmap';
import TeamOpsView from './components/TeamOpsView';
import MedicalOutpostView from './components/MedicalOutpostView';
import AcademyView from './components/AcademyView';
import LedgerScanner from './components/LedgerScanner';
import AiWorkDirectivesView from './components/AiWorkDirectivesView';
import OutreachEscalationHub from './components/OutreachEscalationHub';
import EcosystemOverview from './components/EcosystemOverview';
import SustainmentCenter from './components/SustainmentCenter';
import SubscriptionView from './components/SubscriptionView';
import AiSetupView from './components/AiSetupView';
import BackendTestPanel from './components/BackendTestPanel';
import { Category, SubscriptionTier, type Report, type Mission, type FeedAnalysis, type Hero, type Rank, SkillLevel, type EducationRole, NftRarity, IapPack, StoreItem, NftTheme, type ChatMessage, IntelItem, type HeroPersona, type TacticalDossier, type TeamMessage, type HealthRecord, Archetype, type SkillType, type AiDirective, SimulationMode, type MissionCompletionSummary, MissionApproach, MissionGoal } from './types';
import { MOCK_REPORTS, INITIAL_HERO_PROFILE, RANKS, IAP_PACKS, STORE_ITEMS, STARTER_MISSION } from './constants';
import { generateHeroPersonaImage, generateHeroPersonaDetails, generateNftDetails, generateHeroBackstory, generateMissionFromIntel, isAiEnabled } from './services/geminiService';
import { useTranslations } from './i18n';
import { mintNft, purchaseStoreItem, purchaseIapPack, ApiError } from './services/api';
export type View = 'mainMenu' | 'categorySelection' | 'hub' | 'heroHub' | 'educationRoleSelection' | 'reportSubmission' | 'missionComplete' | 'reputationAndCurrency' | 'store' | 'reportComplete' | 'liveIntelligence' | 'missionDetail' | 'appLiveIntelligence' | 'generateMission' | 'trainingHolodeck' | 'tacticalVault' | 'transparencyDatabase' | 'aiRegulationHub' | 'incidentRoom' | 'threatMap' | 'teamOps' | 'medicalOutpost' | 'academy' | 'aiWorkDirectives' | 'outreachEscalation' | 'ecosystem' | 'sustainmentCenter' | 'subscription' | 'aiSetup';
export type TextScale = 'standard' | 'large' | 'ultra' | 'magnified';

// --- UPDATED HERO INVENTORY SUPPORT BEGIN (local, no backend) ---
type InventoryItem = {
  sku: string;
  name: string;
  description?: string;
  icon?: string;
  quantity?: number;
};
type HeroWithInventory = Hero & {
  inventory?: InventoryItem[];
  unlockedItemSkus?: string[];
  equippedNftIds?: string[];
};
// --- END UPDATED HERO INVENTORY TYPES ---


const getInitialReports = (): Report[] => {
  const saved = localStorage.getItem('dpal-reports');
  if (saved) {
    try { return JSON.parse(saved).map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) })); } 
    catch (e) { return MOCK_REPORTS; }
  }
  return MOCK_REPORTS;
};

const getInitialMissions = (): Mission[] => {
  const saved = localStorage.getItem('dpal-missions');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((m: any) => ({
        ...m,
        reconActions: m.reconActions || [],
        mainActions: m.mainActions || (m.steps || []).map((s: any, i: number) => ({
            id: `act-${i}`,
            name: s.name,
            task: s.task,
            icon: s.icon,
            whyItMatters: "Essential field requirement.",
            priority: s.priority || 'Medium',
            isComplete: s.isComplete || false,
            /** FIX: Removed invalid properties 'requiredChecks', 'riskChecks', 'evidenceRequired' and added required 'prompts' */
            prompts: s.prompts || [
                { id: `p-${i}-1`, type: 'confirmation', promptText: 'Standard field verification', required: true, responseType: 'checkbox', storedAs: { entity: 'missionLog', field: 'verified' } }
            ],
            impactedSkills: ['Technical', 'Civic']
        })),
        phase: m.phase || (m.status === 'completed' ? 'COMPLETED' : 'OPERATION'),
        currentActionIndex: m.currentActionIndex || 0
      }));
    } catch (e) { return []; }
  }
  return [];
};

const getInitialHero = (): HeroWithInventory => {
  const saved = localStorage.getItem('dpal-hero');
  if (saved) { 
    try { 
      const parsed = JSON.parse(saved);
      // Add inventory/unlockedItemSkus if missing for migration
      if (!parsed.inventory) parsed.inventory = [];
      if (!parsed.unlockedItemSkus) parsed.unlockedItemSkus = [];
      return parsed; 
    } catch (e) { 
      return { ...INITIAL_HERO_PROFILE, inventory: [], unlockedItemSkus: [] }; 
    } 
  }
  return { ...INITIAL_HERO_PROFILE, inventory: [], unlockedItemSkus: [] };
};

const App: React.FC = () => {
  const [reports, setReports] = useState<Report[]>(getInitialReports);
  const [currentView, setCurrentView] = useState<View>('mainMenu');
  const [prevView, setPrevView] = useState<View>('mainMenu');
  const [heroHubTab, setHeroHubTab] = useState<'profile' | 'missions' | 'skills' | 'training' | 'briefing' | 'collection' | 'mint' | 'store'>('profile');
  const [hubTab, setHubTab] = useState<'my_reports' | 'community' | 'work_feed'>('my_reports');
  const [filters, setFilters] = useState({ keyword: '', selectedCategories: [] as Category[], location: '', });

  const [selectedCategoryForSubmission, setSelectedCategoryForSubmission] = useState<Category | null>(null);
  const [selectedIntelForMission, setSelectedIntelForMission] = useState<IntelItem | null>(null);
  const [initialCategoriesForIntel, setInitialCategoriesForIntel] = useState<Category[]>([]);

  const [missions, setMissions] = useState<Mission[]>(getInitialMissions);
  const [hero, setHero] = useState<HeroWithInventory>(getInitialHero);
  const [heroLocation, setHeroLocation] = useState<string>('');
  const [completedReport, setCompletedReport] = useState<Report | null>(null);
  const [completedMissionSummary, setCompletedMissionSummary] = useState<MissionCompletionSummary | null>(null);
  const [itemForPayment, setItemForPayment] = useState<IapPack | StoreItem | null>(null);
  const [selectedMissionForDetail, setSelectedMissionForDetail] = useState<Mission | null>(null);
  const [selectedReportForIncidentRoom, setSelectedReportForIncidentRoom] = useState<Report | null>(null);
  const [globalTextScale, setGlobalTextScale] = useState<TextScale>('standard');
  const [isOfflineMode, setIsOfflineMode] = useState(() => localStorage.getItem('dpal-offline-mode') === 'true');

  // Loading states to prevent multiple simultaneous calls
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  useEffect(() => { localStorage.setItem('dpal-offline-mode', String(isOfflineMode)); }, [isOfflineMode]);

  useEffect(() => {
    document.documentElement.classList.remove('scale-standard', 'scale-large', 'scale-ultra', 'scale-magnified');
    document.documentElement.classList.add(`scale-${globalTextScale}`);
  }, [globalTextScale]);

  useEffect(() => {
    localStorage.setItem('dpal-hero', JSON.stringify(hero));
    localStorage.setItem('dpal-reports', JSON.stringify(reports));
    localStorage.setItem('dpal-missions', JSON.stringify(missions));
  }, [hero, reports, missions]);

  const heroWithRank = useMemo((): HeroWithInventory => {
    let currentRank: Rank = RANKS[0];
    for (const rank of RANKS) { if (hero.xp >= rank.xpNeeded) currentRank = rank; else break; }
    return { ...hero, rank: currentRank.level, title: hero.equippedTitle || currentRank.title };
  }, [hero]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesKeyword = !filters.keyword || 
        report.title.toLowerCase().includes(filters.keyword.toLowerCase()) ||
        report.description.toLowerCase().includes(filters.keyword.toLowerCase());
      const matchesCategory = filters.selectedCategories.length === 0 || 
        filters.selectedCategories.includes(report.category);
      const matchesLocation = !filters.location || 
        report.location.toLowerCase().includes(filters.location.toLowerCase());
      return matchesKeyword && matchesCategory && matchesLocation;
    });
  }, [reports, filters]);

  const handleNavigate = (view: View, category?: Category, targetTab?: any) => {
    const aiViews: View[] = ['liveIntelligence', 'generateMission', 'trainingHolodeck', 'aiWorkDirectives'];
    if (aiViews.includes(view) && !isAiEnabled() && !isOfflineMode) {
        setPrevView(currentView);
        setCurrentView('aiSetup');
        return;
    }
    setPrevView(currentView);
    if (category) { 
        setSelectedCategoryForSubmission(category); 
        setCurrentView('reportSubmission'); 
    } 
    else { 
        if (view === 'heroHub' && targetTab) setHeroHubTab(targetTab); 
        if (view === 'hub' && targetTab) setHubTab(targetTab); 
        setCurrentView(view); 
    }
  };

  const handleCompleteMissionStep = (m: Mission) => {
    const actions = m.phase === 'RECON' ? m.reconActions : m.mainActions;
    const nextIdx = m.currentActionIndex + 1;

    if (nextIdx >= actions.length) {
        if (m.phase === 'RECON') {
            const updated = { ...m, phase: 'OPERATION' as const, currentActionIndex: 0 };
            setMissions(prev => prev.map(mi => mi.id === m.id ? updated : mi));
            setSelectedMissionForDetail(updated);
        } else {
            setMissions(prev => prev.map(mi => mi.id === m.id ? { ...mi, phase: 'COMPLETED', status: 'completed' } : mi));
            setHero(prev => ({ ...prev, heroCredits: prev.heroCredits + m.finalReward.hc, xp: prev.xp + 500 }));
            setCompletedMissionSummary({ title: m.title, rewardHeroCredits: m.finalReward.hc, rewardNft: m.finalReward.nft });
            setCurrentView('missionComplete');
        }
    } else {
        const updated = { ...m, currentActionIndex: nextIdx };
        setMissions(prev => prev.map(mi => mi.id === m.id ? updated : mi));
        setSelectedMissionForDetail(updated);
    }
  };

  const handleAddHeroPersona = async (desc: string, arch: Archetype, sourceImage?: string) => {
    const details = await generateHeroPersonaDetails(desc, arch);
    const imageUrl = await generateHeroPersonaImage(desc, arch, sourceImage);
    const newPersona: HeroPersona = { id: `persona-${Date.now()}`, name: details.name, backstory: details.backstory, combatStyle: details.combatStyle, imageUrl, prompt: desc, archetype: arch };
    setHero(prev => ({ ...prev, personas: [...prev.personas, newPersona], equippedPersonaId: prev.equippedPersonaId || newPersona.id }));
  };

  const handleAddReport = async (rep: any) => {
    const reportId = `rep-${Date.now()}`;
    const finalReport: Report = { 
        ...rep, 
        id: reportId, 
        timestamp: new Date(), 
        hash: `0x${Math.random().toString(16).slice(2)}`, 
        blockchainRef: `txn_${Math.random().toString(36).slice(2)}`, 
        isAuthor: true, 
        status: 'Submitted' 
    };
    setReports(prev => [finalReport, ...prev]);
    setCompletedReport(finalReport);
    setCurrentView('reportComplete');
  };

  // --- STORE PURCHASE LOGIC BEGIN ---

  const handleInitiateHCPurchase = async (iapPack: IapPack) => {
    // Prevent multiple simultaneous IAP purchases or mint actions
    if (isPurchasing || isMinting) return;
    setIsPurchasing(true);
    try {
      const heroId = hero.operativeId || 'default';
      const result = await purchaseIapPack({
        heroId,
        pack: {
          sku: iapPack.sku,
          price: iapPack.price,
          hcAmount: iapPack.hcAmount,
        },
      });

      if (result.ok && result.wallet) {
        setHero(prev => ({
          ...prev,
          heroCredits: result.wallet.balance || prev.heroCredits,
        }));
        alert(`Successfully purchased ${iapPack.sku}! Credits added: ${iapPack.hcAmount}`);
      }
    } catch (error: any) {
      console.error('IAP purchase error:', error);
      const message = error instanceof ApiError 
        ? error.message 
        : `Purchase failed: ${error.message || 'Unknown error. Please check your connection.'}`;
      alert(message);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleInitiateStoreItemPurchase = async (item: StoreItem) => {
    // Block store purchases if any purchase or mint is in progress
    if (isPurchasing || isMinting) return;
    setIsPurchasing(true);
    try {
      const heroId = hero.operativeId || 'default';
      const result = await purchaseStoreItem({
        heroId,
        item: {
          sku: item.sku,
          name: item.name,
          description: item.description,
          icon: item.icon,
          price: item.price,
        },
      });

      if (result.ok && result.hero && result.wallet) {
        setHero(prev => ({
          ...prev,
          heroCredits: result.wallet.balance || prev.heroCredits,
          inventory: result.hero.inventory || prev.inventory || [],
          unlockedItemSkus: result.hero.unlockedItemSkus || prev.unlockedItemSkus || [],
        }));
        alert(`Successfully purchased ${item.name}!`);
      }
    } catch (error: any) {
      console.error('Store purchase error:', error);
      const message = error instanceof ApiError 
        ? error.message 
        : `Purchase failed: ${error.message || 'Unknown error. Please check your connection.'}`;
      alert(message);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col transition-all duration-300 bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      <Header 
        onNavigateToHeroHub={() => handleNavigate('heroHub', undefined, 'profile')} 
        onNavigateHome={() => setCurrentView('mainMenu')} 
        onNavigateToReputationAndCurrency={() => setCurrentView('reputationAndCurrency')} 
        onNavigateMissions={() => handleNavigate('liveIntelligence')} 
        onNavigate={handleNavigate} 
        hero={heroWithRank} 
        textScale={globalTextScale} 
        setTextScale={setGlobalTextScale} 
      />
      
      <main className="container mx-auto px-4 py-8 flex-grow relative z-10">
        {currentView === 'aiSetup' && (
          <AiSetupView onReturn={() => setCurrentView('mainMenu')} onEnableOfflineMode={() => { setIsOfflineMode(true); setCurrentView(prevView || 'mainMenu'); }} />
        )}
        
        {currentView === 'mainMenu' && (
          <MainMenu onNavigate={handleNavigate} totalReports={reports.length} onGenerateMissionForCategory={(cat) => { setInitialCategoriesForIntel([cat]); handleNavigate('liveIntelligence'); }} />
        )}

        {currentView === 'categorySelection' && (
          <CategorySelectionView 
            onSelectCategory={(cat) => handleNavigate('reportSubmission', cat)} 
            onSelectMissions={(cat) => { setInitialCategoriesForIntel([cat]); handleNavigate('liveIntelligence'); }} 
            onReturnToHub={() => setCurrentView('mainMenu')} 
          />
        )}

        {currentView === 'reportSubmission' && selectedCategoryForSubmission && (
          <ReportSubmissionView 
            category={selectedCategoryForSubmission} 
            role={null} 
            onReturn={() => setCurrentView('categorySelection')} 
            addReport={handleAddReport} 
            totalReports={reports.length} 
          />
        )}

        {currentView === 'reportComplete' && completedReport && (
          <ReportCompleteView report={completedReport} onReturn={() => setCurrentView('mainMenu')} onEnterSituationRoom={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} />
        )}

        {currentView === 'hub' && (
          <div className="space-y-10">
            <LedgerScanner reports={reports} onTargetFound={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8">
                <MainContentPanel reports={reports} filteredReports={filteredReports} analysis={null} analysisError={null} onCloseAnalysis={() => {}} onAddReportImage={() => {}} onReturnToMainMenu={() => setCurrentView('mainMenu')} onJoinReportChat={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} activeTab={hubTab} setActiveTab={setHubTab} onAddNewReport={() => handleNavigate('categorySelection')} />
              </div>
              <div className="lg:col-span-4">
                <FilterPanel filters={filters} setFilters={setFilters} onAnalyzeFeed={() => handleNavigate('liveIntelligence')} isAnalyzing={false} reportCount={reports.length} hero={heroWithRank} reports={reports} onJoinReportChat={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} onAddNewReport={() => handleNavigate('categorySelection')} />
              </div>
            </div>
          </div>
        )}

        {currentView === 'liveIntelligence' && (
          <LiveIntelligenceView onReturn={() => setCurrentView(prevView === 'heroHub' ? 'heroHub' : 'mainMenu')} onGenerateMission={(intel) => { setSelectedIntelForMission(intel); setCurrentView('generateMission'); }} heroLocation={heroLocation} setHeroLocation={setHeroLocation} initialCategories={initialCategoriesForIntel} textScale={globalTextScale} />
        )}

        {currentView === 'generateMission' && selectedIntelForMission && (
          <GenerateMissionView
            intelItem={selectedIntelForMission}
            onReturn={() => handleNavigate('liveIntelligence')}
            onAcceptMission={async (intel, approach, goal) => {
              try {

                const m = await generateMissionFromIntel(intel, approach, goal);

                const structuredM: Mission = {
                  ...m,
                  id: `msn-${Date.now()}`,
                  phase: 'RECON',
                  currentActionIndex: 0,
                  status: 'active',
                  reconActions: [
                    { id: 'rec-1', name: 'Coordinate Survey', task: 'Verify geospatial center of target.', whyItMatters: "Ensures legal jurisdiction and node alignment.", icon: '🛰️', priority: 'High', isComplete: false, prompts: [{ id: 'p-rec-1', type: 'confirmation', promptText: 'GPS Link Verified', required: true, responseType: 'checkbox', storedAs: { entity: 'riskAssessment', field: 'gps_verified' } }], impactedSkills: ['Technical'] },
                    { id: 'rec-2', name: 'Strategic Mapping', task: 'Identify impacted citizens.', whyItMatters: "Quantifies community harm factor.", icon: '👥', priority: 'Medium', isComplete: false, prompts: [{ id: 'p-rec-2', type: 'observation', promptText: 'Sector count verified', required: true, responseType: 'text', storedAs: { entity: 'missionLog', field: 'impact_count' } }], impactedSkills: ['Empathy'] },
                  ],
                  mainActions: (m.steps || []).map((s: any, i: number) => ({
                    id: `act-${i}`,
                    name: s.name,
                    task: s.task,
                    whyItMatters: s.whyItMatters || "Primary field directive.",
                    icon: s.icon,
                    priority: s.priority || 'Medium',
                    isComplete: false,
                    prompts: s.prompts || [],
                    impactedSkills: ['Forensic', 'Tactical']
                  }))
                };

                setMissions(prev => [structuredM, ...prev]);
                handleNavigate('heroHub', undefined, 'missions');
              } catch (error: any) {
                console.error('Mission generation error:', error);
                alert(`Failed to generate mission: ${error.message || 'Unknown error'}`);
              }
            }}
          />
        )}

        {currentView === 'missionDetail' && selectedMissionForDetail && (
          <MissionDetailView mission={selectedMissionForDetail} onReturn={() => handleNavigate('heroHub', undefined, 'missions')} messages={[]} onSendMessage={() => {}} hero={heroWithRank} onCompleteMissionStep={handleCompleteMissionStep} />
        )}

        {currentView === 'missionComplete' && completedMissionSummary && (
          <MissionCompleteView mission={completedMissionSummary} onReturn={() => setCurrentView('mainMenu')} />
        )}

        {currentView === 'heroHub' && (
          <HeroHub 
            onReturnToHub={() => setCurrentView('mainMenu')}
            missions={missions} 
            isLoadingMissions={false} 
            hero={heroWithRank} 
            setHero={setHero as React.Dispatch<React.SetStateAction<Hero>>} 
            heroLocation={heroLocation} 
            setHeroLocation={setHeroLocation} 
            onGenerateNewMissions={() => {}} 
            onMintNft={async (prompt: string, theme: NftTheme, category: Category, extra?: any) => {
              if (isMinting) throw new Error("Mint already in progress. Please wait.");
              setIsMinting(true);
              try {
                const heroId = hero.operativeId || 'default';
                const result = await mintNft({
                  userId: heroId,
                  prompt,
                  theme,
                  category,
                  priceCredits: extra?.totalCost || 500,
                  traits: extra?.traits || [],
                });

                // Create a Report from the mint result
                const mintedReport: Report = {
                  id: `nft-${result.tokenId}`,
                  title: `MINTED: ${prompt}`,
                  description: `NFT artifact minted successfully. Token ID: ${result.tokenId}`,
                  category,
                  location: 'DPAL Network',
                  timestamp: new Date(result.mintedAt || Date.now()),
                  hash: result.txHash || `0x${Math.random().toString(16).slice(2)}`,
                  blockchainRef: result.txHash || '',
                  status: 'Submitted',
                  trustScore: 100,
                  severity: 'Informational',
                  isActionable: false,
                  imageUrls: result.imageUrl ? [result.imageUrl] : []
                };

                // Update hero credits and add NFT to collection
                setHero(prev => {
                  const currentNftIds = (prev as HeroWithInventory).equippedNftIds || [];
                  return {
                    ...prev,
                    heroCredits: (prev.heroCredits || 0) - (result.priceCredits || 500),
                    equippedNftIds: [...currentNftIds, result.tokenId]
                  };
                });

                return mintedReport;

              } catch (error: any) {
                console.error('Mint error:', error);
                const message = error instanceof ApiError
                  ? error.message
                  : `Neural link failed: ${error.message || 'Transient neural disruption. Link stability low. Check system node status and API configuration.'}`;
                throw new Error(message);
              } finally {
                setIsMinting(false);
              }
            }}
            reports={reports} 
            iapPacks={IAP_PACKS} 
            storeItems={STORE_ITEMS} 
            onInitiateHCPurchase={handleInitiateHCPurchase}
            onInitiateStoreItemPurchase={handleInitiateStoreItemPurchase}
            onAddHeroPersona={handleAddHeroPersona} 
            onDeleteHeroPersona={() => {}} 
            onEquipHeroPersona={(pid) => setHero(prev => ({ ...prev, equippedPersonaId: pid }))}
            onGenerateHeroBackstory={async () => {}} 
            onNavigateToMissionDetail={(m) => { setSelectedMissionForDetail(m); setCurrentView('missionDetail'); }} 
            onNavigate={handleNavigate} 
            activeTab={heroHubTab} 
            setActiveTab={setHeroHubTab} 
          />
        )}

        {currentView === 'transparencyDatabase' && (
          <TransparencyDatabaseView onReturn={() => setCurrentView('mainMenu')} hero={heroWithRank} reports={reports} filters={filters} setFilters={setFilters} onJoinReportChat={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} />
        )}

        {currentView === 'trainingHolodeck' && (
          <TrainingHolodeckView hero={heroWithRank} onReturn={() => setCurrentView('mainMenu')} onComplete={() => {}} />
        )}

        {currentView === 'incidentRoom' && selectedReportForIncidentRoom && (
          <IncidentRoomView report={selectedReportForIncidentRoom} hero={heroWithRank} onReturn={() => setCurrentView('hub')} messages={[]} onSendMessage={() => {}} />
        )}

        {currentView === 'reputationAndCurrency' && (
          <ReputationAndCurrencyView onReturn={() => setCurrentView('mainMenu')} />
        )}

        {currentView === 'ecosystem' && (
          <EcosystemOverview onReturn={() => setCurrentView('mainMenu')} />
        )}
      </main>
      {(isMinting || isPurchasing) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-zinc-800 px-8 py-6 rounded-xl text-lg text-cyan-200 font-semibold shadow-lg flex flex-row items-center gap-4">
            <svg className="animate-spin h-6 w-6 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
            <span>
              {isMinting ? "Minting in progress. Please wait..." : "Processing purchase..."}
            </span>
          </div>
        </div>
      )}

      {/* Backend Test Panel - Always visible for debugging */}
      <BackendTestPanel />
    </div>
  );
};

export default App;

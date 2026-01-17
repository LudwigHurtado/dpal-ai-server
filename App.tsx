
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
import TutorialMissionView from './components/TutorialMissionView';
import TestAccessGate from './components/TestAccessGate';
import { Category, SubscriptionTier, type Report, type Mission, type FeedAnalysis, type Hero, type Rank, SkillLevel, type EducationRole, NftRarity, IapPack, StoreItem, NftTheme, type ChatMessage, IntelItem, type HeroPersona, type TacticalDossier, type TeamMessage, type HealthRecord, Archetype, type SkillType, type AiDirective, SimulationMode, type MissionCompletionSummary, MissionApproach, MissionGoal } from './types';
import { MOCK_REPORTS, INITIAL_HERO_PROFILE, RANKS, IAP_PACKS, STORE_ITEMS, STARTER_MISSION } from './constants';
import { generateNftImage, generateHeroPersonaImage, generateHeroPersonaDetails, generateNftDetails, generateHeroBackstory, generateMissionFromIntel, isAiEnabled, extractVisualDescriptors } from './services/geminiService';
import { apiService } from './services/apiService';
import { useTranslations } from './i18n';

export type View = 'mainMenu' | 'categorySelection' | 'hub' | 'heroHub' | 'educationRoleSelection' | 'reportSubmission' | 'missionComplete' | 'reputationAndCurrency' | 'store' | 'reportComplete' | 'liveIntelligence' | 'missionDetail' | 'appLiveIntelligence' | 'generateMission' | 'trainingHolodeck' | 'tacticalVault' | 'transparencyDatabase' | 'aiRegulationHub' | 'incidentRoom' | 'threatMap' | 'teamOps' | 'medicalOutpost' | 'academy' | 'aiWorkDirectives' | 'outreachEscalation' | 'ecosystem' | 'sustainmentCenter' | 'subscription' | 'aiSetup' | 'tutorial';
export type TextScale = 'standard' | 'large' | 'ultra' | 'magnified';

const getInitialHero = (): Hero => {
  const saved = localStorage.getItem('dpal-hero');
  if (saved) { try { return JSON.parse(saved); } catch (e) { return INITIAL_HERO_PROFILE; } }
  return INITIAL_HERO_PROFILE;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const App: React.FC = () => {
  // TEST ACCESS GATE LOGIC
  const isTestPhase = process.env.DPAL_TEST_PHASE !== 'false';
  const [testGranted, setTestGranted] = useState(() => localStorage.getItem('dpal_test_access_granted_v1') === 'true');

  const [reports, setReports] = useState<Report[]>([]);
  const [chatsByReportId, setChatsByReportId] = useState<Record<string, ChatMessage[]>>({});
  const [currentView, setCurrentView] = useState<View>('mainMenu');
  const [prevView, setPrevView] = useState<View>('mainMenu');
  const [heroHubTab, setHeroHubTab] = useState<'profile' | 'missions' | 'skills' | 'training' | 'briefing' | 'collection' | 'mint' | 'store'>('profile');
  const [hubTab, setHubTab] = useState<'my_reports' | 'community' | 'work_feed'>('my_reports');
  const [filters, setFilters] = useState({ keyword: '', selectedCategories: [] as Category[], location: '', });
  const [networkStatus, setNetworkStatus] = useState<'OFFLINE' | 'SYNCING' | 'LIVE' | 'MOCK'>('OFFLINE');

  const [selectedCategoryForSubmission, setSelectedCategoryForSubmission] = useState<Category | null>(null);
  const [selectedIntelForMission, setSelectedIntelForMission] = useState<IntelItem | null>(null);
  const [initialCategoriesForIntel, setInitialCategoriesForIntel] = useState<Category[]>([]);
  
  const [missions, setMissions] = useState<Mission[]>([]);
  const [hero, setHero] = useState<Hero>(getInitialHero);
  const [heroLocation, setHeroLocation] = useState<string>('');
  const [completedReport, setCompletedReport] = useState<Report | null>(null);
  const [completedMissionSummary, setCompletedMissionSummary] = useState<MissionCompletionSummary | null>(null);
  const [selectedMissionForDetail, setSelectedMissionForDetail] = useState<Mission | null>(null);
  const [selectedReportForIncidentRoom, setSelectedReportForIncidentRoom] = useState<Report | null>(null);
  const [globalTextScale, setGlobalTextScale] = useState<TextScale>('standard');
  const [isOfflineMode, setIsOfflineMode] = useState(() => localStorage.getItem('dpal-offline-mode') === 'true');

  // LOAD LIVE LEDGER ON STARTUP
  const syncLedger = useCallback(async () => {
    setNetworkStatus('SYNCING');
    try {
      const liveReports = await apiService.getReports();
      setReports(liveReports.length > 0 ? liveReports : MOCK_REPORTS);
      setNetworkStatus(apiService.isMock() ? 'MOCK' : 'LIVE');
    } catch (e) {
      console.error("Live sync failure", e);
      setNetworkStatus('OFFLINE');
    }
  }, []);

  useEffect(() => {
    if (!testGranted && isTestPhase) return;
    syncLedger();
    const interval = setInterval(syncLedger, 60000);
    return () => clearInterval(interval);
  }, [syncLedger, testGranted, isTestPhase]);

  useEffect(() => { localStorage.setItem('dpal-offline-mode', String(isOfflineMode)); }, [isOfflineMode]);

  useEffect(() => {
    document.documentElement.classList.remove('scale-standard', 'scale-large', 'scale-ultra', 'scale-magnified');
    document.documentElement.classList.add(`scale-${globalTextScale}`);
  }, [globalTextScale]);

  useEffect(() => {
    localStorage.setItem('dpal-hero', JSON.stringify(hero));
  }, [hero]);

  const goBack = useCallback(() => {
      if (currentView === 'mainMenu' || currentView === 'tutorial') return;
      setCurrentView(prevView || 'mainMenu');
  }, [currentView, prevView]);

  const heroWithRank = useMemo((): Hero => {
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

  const handleAddReport = async (rep: any) => {
    setNetworkStatus('SYNCING');
    try {
        // FIX: Handle File objects for mock serialization
        const processedImageUrls = [...(rep.imageUrls || [])];
        if (apiService.isMock() && rep.attachments) {
            const fileAttachments = rep.attachments.filter((a: any) => a instanceof File);
            const base64Proms = fileAttachments.map((f: File) => fileToBase64(f));
            const base64Results = await Promise.all(base64Proms);
            processedImageUrls.push(...base64Results);
        }

        const finalReport = await apiService.createReport({
            ...rep,
            imageUrls: processedImageUrls,
            authorId: hero.operativeId,
            isAuthor: true,
            attachments: undefined // Do not store raw File objects in ledger
        });

        setReports(prev => [finalReport, ...prev]);
        setCompletedReport(finalReport);
        setCurrentView('reportComplete');
        setNetworkStatus(apiService.isMock() ? 'MOCK' : 'LIVE');
    } catch (e) {
        alert("Transmission to ledger failed. Local buffer only.");
        setNetworkStatus('OFFLINE');
    }
  };

  const handleTutorialComplete = async (reportData: Partial<Report>, isPractice: boolean) => {
      const finalReport = await apiService.createReport({
          ...reportData,
          authorId: hero.operativeId,
          isAuthor: true,
          status: isPractice ? 'Practice' : 'Submitted'
      });
      setReports(prev => [finalReport, ...prev]);
      setHero(prev => ({ ...prev, xp: prev.xp + 200 })); 
      localStorage.setItem("dpal_first_run_complete", "true");
      setCurrentView('mainMenu');
  };

  const handleSendMessageToRoom = async (reportId: string, text: string, img?: string, aud?: string) => {
    const msg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: heroWithRank.name,
        authorId: hero.operativeId,
        text,
        imageUrl: img,
        audioUrl: aud,
        timestamp: Date.now(),
        ledgerProof: `0x${Math.random().toString(16).slice(2, 10)}`,
        avatarUrl: hero.personas.find(p => p.id === hero.equippedPersonaId)?.imageUrl
    };
    
    try {
        const savedMsg = await apiService.sendMessage(reportId, msg);
        setChatsByReportId(prev => ({
            ...prev,
            [reportId]: [...(prev[reportId] || []), savedMsg]
        }));
    } catch (e) {
        console.error("Message sync error", e);
    }
  };

  const handleCertificateReady = (reportId: string, pdfDataUrl: string) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, certificatePdfDataUrl: pdfDataUrl } : r));
  };

  const handleCompleteMissionStep = useCallback((mission: Mission) => {
    setMissions(prev => prev.map(m => {
      if (m.id === mission.id) {
        const currentActions = m.phase === 'RECON' ? m.reconActions : m.mainActions;
        const nextIndex = (m.currentActionIndex || 0) + 1;
        
        if (nextIndex >= currentActions.length) {
          if (m.phase === 'RECON') {
            return { ...m, phase: 'OPERATION', currentActionIndex: 0 };
          } else {
            const summary: MissionCompletionSummary = {
                title: m.title,
                rewardHeroCredits: m.finalReward.hc,
                rewardLegendTokens: m.finalReward.legendTokens,
                rewardNft: m.finalReward.nft
            };
            setCompletedMissionSummary(summary);
            setCurrentView('missionComplete');
            setHero(prev => ({ 
                ...prev, 
                heroCredits: prev.heroCredits + m.finalReward.hc,
                legendTokens: prev.legendTokens + (m.finalReward.legendTokens || 0),
                xp: prev.xp + 500
            }));
            return { ...m, currentActionIndex: nextIndex, status: 'completed' as const, phase: 'COMPLETED' };
          }
        }
        return { ...m, currentActionIndex: nextIndex };
      }
      return m;
    }));
  }, []);

  const handleAddHeroPersona = async (description: string, archetype: Archetype, sourceImage?: string, prop?: string, stance?: string, descriptors?: string) => {
    setNetworkStatus('SYNCING');
    try {
        const details = await generateHeroPersonaDetails(description, archetype);
        const img = await generateHeroPersonaImage(descriptors || description, archetype, prop, stance); 
        
        const newPersona: HeroPersona = {
            id: `persona-${Date.now()}`,
            prompt: description,
            name: details.name,
            backstory: details.backstory,
            combatStyle: details.combatStyle,
            imageUrl: img,
            archetype
        };
        
        setHero(prev => ({
            ...prev,
            personas: [...prev.personas, newPersona],
            equippedPersonaId: prev.equippedPersonaId || newPersona.id
        }));
        setNetworkStatus(apiService.isMock() ? 'MOCK' : 'LIVE');
    } catch (e) {
        console.error("Synthesis error:", e);
        setNetworkStatus('OFFLINE');
    }
  };

  // RENDER ACCESS GATE
  if (isTestPhase && !testGranted) {
    return <TestAccessGate onGranted={() => setTestGranted(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col transition-all duration-300 bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      {currentView !== 'tutorial' && (
        <Header 
            onNavigateToHeroHub={() => handleNavigate('heroHub', undefined, 'profile')} 
            onNavigateHome={() => setCurrentView('mainMenu')} 
            onNavigateToReputationAndCurrency={() => setCurrentView('reputationAndCurrency')} 
            onNavigateMissions={() => handleNavigate('liveIntelligence')} 
            onNavigate={handleNavigate} 
            hero={heroWithRank} 
            textScale={globalTextScale} 
            setTextScale={setGlobalTextScale} 
            networkStatus={networkStatus}
        />
      )}
      
      <main className={`${currentView === 'tutorial' ? 'p-0' : 'container mx-auto px-4 py-8'} flex-grow relative z-10`}>
        {currentView === 'aiSetup' && (
          <AiSetupView onReturn={() => setCurrentView('mainMenu')} onEnableOfflineMode={() => { setIsOfflineMode(true); setCurrentView(prevView || 'mainMenu'); }} />
        )}

        {currentView === 'tutorial' && (
            <TutorialMissionView 
                onComplete={handleTutorialComplete}
                onSkip={() => { setCurrentView('mainMenu'); }}
            />
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
          <ReportCompleteView 
            report={completedReport} 
            onReturn={() => setCurrentView('mainMenu')} 
            onEnterSituationRoom={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} 
            onCertificateReady={handleCertificateReady}
          />
        )}

        {currentView === 'hub' && (
          <div className="space-y-10 flex flex-col h-full">
            <LedgerScanner reports={reports} onTargetFound={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} />
            <div className="flex-grow">
                <MainContentPanel 
                    reports={reports} 
                    filteredReports={filteredReports} 
                    analysis={null} 
                    analysisError={null} 
                    onCloseAnalysis={() => {}} 
                    onAddReportImage={() => {}} 
                    onReturnToMainMenu={() => setCurrentView('mainMenu')} 
                    onJoinReportChat={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} 
                    activeTab={hubTab} 
                    setActiveTab={setHubTab} 
                    onAddNewReport={() => handleNavigate('categorySelection')} 
                    filters={filters}
                    setFilters={setFilters}
                    hero={heroWithRank}
                />
            </div>
          </div>
        )}

        {currentView === 'liveIntelligence' && (
          <LiveIntelligenceView onReturn={() => setCurrentView(prevView === 'heroHub' ? 'heroHub' : 'mainMenu')} onGenerateMission={(intel) => { setSelectedIntelForMission(intel); setCurrentView('generateMission'); }} heroLocation={heroLocation} setHeroLocation={setHeroLocation} initialCategories={initialCategoriesForIntel} textScale={globalTextScale} />
        )}

        {currentView === 'generateMission' && selectedIntelForMission && (
          <GenerateMissionView intelItem={selectedIntelForMission} onReturn={() => handleNavigate('liveIntelligence')} onAcceptMission={async (intel, approach, goal) => {
              const m = await generateMissionFromIntel(intel, approach, goal);
              const structuredM: Mission = {
                  ...m,
                  id: `msn-${Date.now()}`,
                  phase: 'RECON',
                  currentActionIndex: 0,
                  status: 'active',
                  reconActions: [
                      { id: 'p-rec-1', type: 'confirmation', promptText: 'GPS Link Verified', required: true, responseType: 'checkbox', storedAs: { entity: 'riskAssessment', field: 'gps_verified' } },
                      { id: 'p-rec-2', type: 'observation', promptText: 'Sector count verified', required: true, responseType: 'text', storedAs: { entity: 'missionLog', field: 'impact_count' } },
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
          }} />
        )}

        {currentView === 'missionDetail' && selectedMissionForDetail && (
          <MissionDetailView mission={selectedMissionForDetail} onReturn={() => handleNavigate('heroHub', undefined, 'missions')} messages={[]} onSendMessage={() => {}} hero={heroWithRank} onCompleteMissionStep={handleCompleteMissionStep} />
        )}

        {currentView === 'missionComplete' && completedMissionSummary && (
          <MissionCompleteView mission={completedMissionSummary} onReturn={() => setCurrentView('mainMenu')} />
        )}

        {currentView === 'heroHub' && (
          <HeroHub onReturnToHub={() => setCurrentView('mainMenu')} missions={missions} isLoadingMissions={false} hero={heroWithRank} setHero={setHero} heroLocation={heroLocation} setHeroLocation={setHeroLocation} onGenerateNewMissions={() => {}} onMintNft={async () => ({} as any)} reports={reports} iapPacks={IAP_PACKS} storeItems={STORE_ITEMS} onInitiateHCPurchase={() => {}} onInitiateStoreItemPurchase={() => {}} onAddHeroPersona={handleAddHeroPersona} onDeleteHeroPersona={() => {}} onEquipHeroPersona={(pid) => setHero(prev => ({ ...prev, equippedPersonaId: pid }))} onGenerateHeroBackstory={async () => {}} onNavigateToMissionDetail={(m) => { setSelectedMissionForDetail(m); setCurrentView('missionDetail'); }} onNavigate={handleNavigate} activeTab={heroHubTab} setActiveTab={setHeroHubTab} />
        )}

        {currentView === 'transparencyDatabase' && (
          <TransparencyDatabaseView onReturn={() => setCurrentView('mainMenu')} hero={heroWithRank} reports={reports} filters={filters} setFilters={setFilters} onJoinReportChat={(r) => { setSelectedReportForIncidentRoom(r); setCurrentView('incidentRoom'); }} />
        )}

        {currentView === 'trainingHolodeck' && (
          <TrainingHolodeckView hero={heroWithRank} onReturn={() => setCurrentView('mainMenu')} onComplete={() => {}} />
        )}

        {currentView === 'incidentRoom' && selectedReportForIncidentRoom && (
          <IncidentRoomView 
            report={selectedReportForIncidentRoom} 
            hero={heroWithRank} 
            onReturn={() => setCurrentView('hub')} 
            messages={chatsByReportId[selectedReportForIncidentRoom.id] || []} 
            onSendMessage={(text, img, aud) => handleSendMessageToRoom(selectedReportForIncidentRoom.id, text, img, aud)} 
          />
        )}

        {currentView === 'reputationAndCurrency' && (
          <ReputationAndCurrencyView onReturn={() => setCurrentView('mainMenu')} />
        )}

        {currentView === 'ecosystem' && (
          <EcosystemOverview onReturn={() => setCurrentView('mainMenu')} />
        )}
      </main>
    </div>
  );
};

export default App;

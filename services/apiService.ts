
import type { Report, ChatMessage } from '../types';

/**
 * DPAL LIVE LEDGER BRIDGE
 * 
 * In production, change BASE_URL to your Express/Vercel endpoint.
 * Toggle live mode by setting DPAL_USE_MOCK=false in your environment.
 */
const BASE_URL = '/api'; 

// Environment-driven mock toggle. Defaults to true for local testing.
const USE_MOCK = process.env.DPAL_USE_MOCK !== 'false';

export const apiService = {
  /**
   * Syncs the community feed with the global MongoDB ledger.
   */
  async getReports(): Promise<Report[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 600)); // Simulate latency
      const saved = localStorage.getItem('dpal-reports');
      return saved ? JSON.parse(saved).map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) })) : [];
    }

    const response = await fetch(`${BASE_URL}/reports`);
    if (!response.ok) throw new Error('Global ledger synchronization failure.');
    const data = await response.json();
    return data.map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) }));
  },

  /**
   * Commits a new accountability shard to the live database.
   */
  async createReport(reportData: Partial<Report>): Promise<Report> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 1000));
      const newReport = {
        ...reportData,
        id: `rep-${Date.now()}`,
        timestamp: new Date(),
        hash: `0x${Math.random().toString(16).slice(2, 10)}`,
        blockchainRef: `txn_${Math.random().toString(36).slice(2, 8)}`,
        status: 'Submitted'
      } as Report;
      
      const reports = await this.getReports();
      localStorage.setItem('dpal-reports', JSON.stringify([newReport, ...reports]));
      return newReport;
    }

    const response = await fetch(`${BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    if (!response.ok) throw new Error('Failed to commit shard to ledger.');
    return response.json();
  },

  /**
   * Synchronizes situational room dispatches for a specific report ID.
   */
  async getMessages(reportId: string): Promise<ChatMessage[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 300));
      const saved = localStorage.getItem('dpal-chats');
      const chats = saved ? JSON.parse(saved) : {};
      return chats[reportId] || [];
    }

    const response = await fetch(`${BASE_URL}/reports/${reportId}/messages`);
    if (!response.ok) throw new Error('Room synchronization failed.');
    return response.json();
  },

  /**
   * Broadcasts an analytical dispatch to the incident room.
   */
  async sendMessage(reportId: string, message: ChatMessage): Promise<ChatMessage> {
    if (USE_MOCK) {
      const saved = localStorage.getItem('dpal-chats');
      const chats = saved ? JSON.parse(saved) : {};
      const messages = chats[reportId] || [];
      const newChats = { ...chats, [reportId]: [...messages, message] };
      localStorage.setItem('dpal-chats', JSON.stringify(newChats));
      return message;
    }

    const response = await fetch(`${BASE_URL}/reports/${reportId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error('Transmission failure.');
    return response.json();
  },

  isMock(): boolean {
    return USE_MOCK;
  }
};

import { supabase, isLive } from './supabaseClient';

export interface PresenceState {
  victimId: string;
  userName: string;
  userRole?: string;
  timestamp: number;
}

type PresenceCallback = (activeEditors: Record<string, PresenceState>) => void;

class PresenceService {
  private activeEditors: Record<string, PresenceState> = {};
  private listeners: Set<PresenceCallback> = new Set();
  private bc: BroadcastChannel;
  private realtimeChannel: any = null;
  private currentEditingVictimId: string | null = null;
  private heartbeatTimer: any = null;

  constructor() {
    this.bc = new BroadcastChannel('dps65_presence_channel');
    this.bc.onmessage = (e) => {
      if (e.data?.type === 'PRESENCE_UPDATE') {
        this.handlePresenceData(e.data.payload);
      } else if (e.data?.type === 'PRESENCE_CLEAR') {
        this.handlePresenceClear(e.data.victimId);
      }
    };

    // Nettoyage automatique des éditeurs inactifs (> 45 secondes)
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      Object.keys(this.activeEditors).forEach(vId => {
        if (now - this.activeEditors[vId].timestamp > 45000) {
          delete this.activeEditors[vId];
          changed = true;
        }
      });
      if (changed) this.notifyListeners();
    }, 10000);

    this.initSupabasePresence();
  }

  private initSupabasePresence() {
    if (!isLive || !supabase) return;
    try {
      this.realtimeChannel = supabase.channel('global_presence_channel');
      this.realtimeChannel
        .on('broadcast', { event: 'editing_victim' }, (payload: any) => {
          if (payload?.payload) {
            this.handlePresenceData(payload.payload);
          }
        })
        .on('broadcast', { event: 'clear_editing_victim' }, (payload: any) => {
          if (payload?.victimId) {
            this.handlePresenceClear(payload.victimId);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn("Supabase presence channel error:", e);
    }
  }

  private handlePresenceData(state: PresenceState) {
    this.activeEditors[state.victimId] = state;
    this.notifyListeners();
  }

  private handlePresenceClear(victimId: string) {
    if (this.activeEditors[victimId]) {
      delete this.activeEditors[victimId];
      this.notifyListeners();
    }
  }

  public setEditing(victimId: string, userName: string, userRole?: string) {
    this.currentEditingVictimId = victimId;
    const payload: PresenceState = {
      victimId,
      userName,
      userRole,
      timestamp: Date.now()
    };

    this.activeEditors[victimId] = payload;
    this.notifyListeners();

    // Broadcast local & Supabase
    this.bc.postMessage({ type: 'PRESENCE_UPDATE', payload });
    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'editing_victim',
        payload
      }).catch(() => {});
    }

    // Heartbeat toutes les 20s
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.currentEditingVictimId === victimId) {
        payload.timestamp = Date.now();
        this.bc.postMessage({ type: 'PRESENCE_UPDATE', payload });
        if (this.realtimeChannel) {
          this.realtimeChannel.send({
            type: 'broadcast',
            event: 'editing_victim',
            payload
          }).catch(() => {});
        }
      }
    }, 20000);
  }

  public clearEditing(victimId?: string) {
    const targetId = victimId || this.currentEditingVictimId;
    if (!targetId) return;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    delete this.activeEditors[targetId];
    if (this.currentEditingVictimId === targetId) {
      this.currentEditingVictimId = null;
    }

    this.notifyListeners();

    this.bc.postMessage({ type: 'PRESENCE_CLEAR', victimId: targetId });
    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'clear_editing_victim',
        victimId: targetId
      }).catch(() => {});
    }
  }

  public subscribe(cb: PresenceCallback) {
    this.listeners.add(cb);
    cb(this.activeEditors);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb({ ...this.activeEditors }));
  }
}

export const presenceService = new PresenceService();

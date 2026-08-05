type BandwidthListener = (isDegraded: boolean) => void;

class BandwidthService {
  private isDegradedMode: boolean = false;
  private listeners: Set<BandwidthListener> = new Set();

  constructor() {
    this.detectNetworkCondition();
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => this.detectNetworkCondition());
      }
    }
  }

  private detectNetworkCondition() {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        const type = connection.effectiveType; // '2g', '3g', '4g', 'slow-2g'
        const saveData = connection.saveData;
        const rtt = connection.rtt || 0;

        if (type === '2g' || type === 'slow-2g' || saveData || rtt > 800) {
          this.setDegradedMode(true);
        }
      }
    }
  }

  public setDegradedMode(active: boolean) {
    if (this.isDegradedMode !== active) {
      this.isDegradedMode = active;
      this.notifyListeners();
    }
  }

  public isDegraded(): boolean {
    return this.isDegradedMode;
  }

  public subscribe(cb: BandwidthListener) {
    this.listeners.add(cb);
    cb(this.isDegradedMode);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this.isDegradedMode));
  }
}

export const bandwidthService = new BandwidthService();

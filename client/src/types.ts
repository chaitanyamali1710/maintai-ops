export type Status = 'healthy' | 'warning' | 'critical' | 'offline';

export interface Reading {
  machineId: string;
  temperature: number;
  vibration: number;
  pressure: number;
  power: number;
  rpm: number;
  riskScore: number;
  timestamp: string;
}

export interface Machine {
  id: string;
  name: string;
  type: string;
  location: string;
  status: Status;
  health: number;
  nextMaintenance: string;
  reading: Reading;
  history: Reading[];
}

export interface Alert {
  id: string;
  machineId: string;
  machineName: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  machineId: string;
  machineName: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'completed';
  assignedTo: string;
  dueDate: string;
}

export interface ReplayScenario {
  id: string;
  windows: number;
  trueLabel: string;
  recording: string;
  defectSizeIn: number;
  faultStartsAt?: number;
}

export interface ReplayCatalogue {
  available: boolean;
  samplingRate: number;
  windowSize: number;
  heldOutLoadHp: number;
  note: string;
  scenarios: ReplayScenario[];
}

export interface ReplayStep {
  scenario: string;
  index: number;
  total: number;
  predictedFault: string;
  trueLabel: string;
  correct: boolean;
  confidence: number;
  probabilities: Record<string, number>;
  isFault: boolean;
  waveform: number[];
  rmsAmplitude: number;
}

export interface DashboardData {
  machines: Machine[];
  alerts: Alert[];
  workOrders: WorkOrder[];
  metrics: {
    totalMachines: number;
    operational: number;
    activeAlerts: number;
    averageHealth: number;
    avoidedDowntimeHours: number;
  };
}

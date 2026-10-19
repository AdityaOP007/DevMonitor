import type {
  AlertConfig,
  AlertItem,
  ApiMetricsOverview,
  CpuMetricPoint,
  DatabaseStats,
  DashboardMetrics,
  HealthResponse,
  RequestMetricPoint,
  ResponseTimeMetricPoint,
  ServerMetrics,
  ServiceItem,
  SystemErrorItem,
  UrlCheckResult,
} from '../types';

interface MockState {
  isBackendDown: boolean;
  isHighCpu: boolean;
  isHighErrorRate: boolean;
  isSlowApi: boolean;
  requests: number;
  errors: number;
  responseTime: number;
  uptime: number;
  cpu: number;
  memory: number;
  disk: number;
  alertConfig: AlertConfig;
  recentErrors: SystemErrorItem[];
  activeAlerts: AlertItem[];
  requestHistory: RequestMetricPoint[];
  cpuHistory: CpuMetricPoint[];
  responseTimeHistory: ResponseTimeMetricPoint[];
}

const initialAlertConfig: AlertConfig = {
  cpuThreshold: 80,
  memoryThreshold: 85,
  errorRateThreshold: 5,
  responseTimeThreshold: 300,
  durationMinutes: 5,
};

const initialRequestHistory: RequestMetricPoint[] = [
  { time: '18:50', requests: 240 },
  { time: '18:52', requests: 255 },
  { time: '18:54', requests: 230 },
  { time: '18:56', requests: 280 },
  { time: '18:58', requests: 310 },
  { time: '19:00', requests: 295 },
  { time: '19:02', requests: 320 },
];

const initialCpuHistory: CpuMetricPoint[] = [
  { time: '18:50', cpu: 38 },
  { time: '18:52', cpu: 41 },
  { time: '18:54', cpu: 40 },
  { time: '18:56', cpu: 44 },
  { time: '18:58', cpu: 42 },
  { time: '19:00', cpu: 43 },
  { time: '19:02', cpu: 42 },
];

const initialResponseTimeHistory: ResponseTimeMetricPoint[] = [
  { time: '18:50', responseTime: 138 },
  { time: '18:52', responseTime: 145 },
  { time: '18:54', responseTime: 140 },
  { time: '18:56', responseTime: 149 },
  { time: '18:58', responseTime: 142 },
  { time: '19:00', responseTime: 144 },
  { time: '19:02', responseTime: 142 },
];

const initialErrors: SystemErrorItem[] = [
  { id: 'err-1', status: 500, path: '/api/users', timeAgo: '2 mins ago' },
  { id: 'err-2', status: 503, path: '/api/checkout', timeAgo: '6 mins ago' },
  { id: 'err-3', status: 404, path: '/api/v1/profile/unknown', timeAgo: '14 mins ago' },
];

let state: MockState = {
  isBackendDown: false,
  isHighCpu: false,
  isHighErrorRate: false,
  isSlowApi: false,
  requests: 15234,
  errors: 32,
  responseTime: 142,
  uptime: 99.9,
  cpu: 42,
  memory: 61,
  disk: 38,
  alertConfig: { ...initialAlertConfig },
  recentErrors: [...initialErrors],
  activeAlerts: [
    {
      id: 'alt-1',
      severity: 'warning',
      title: 'HIGH CPU USAGE',
      message: 'CPU 91%, Duration 5 minutes',
      timestamp: '10 mins ago',
      active: false,
    },
  ],
  requestHistory: [...initialRequestHistory],
  cpuHistory: [...initialCpuHistory],
  responseTimeHistory: [...initialResponseTimeHistory],
};

export const mockDataService = {
  getHealth: (): HealthResponse => {
    if (state.isBackendDown) {
      return { status: 'down', service: 'devmonitor-api', uptime: 0 };
    }
    if (state.isHighErrorRate || state.isHighCpu || state.isSlowApi) {
      return { status: 'degraded', service: 'devmonitor-api', uptime: 12345 };
    }
    return { status: 'healthy', service: 'devmonitor-api', uptime: 12345 };
  },

  getServer: (): ServerMetrics => {
    return {
      cpu: state.isBackendDown ? 0 : state.cpu,
      memory: state.isBackendDown ? 0 : state.memory,
      disk: state.disk,
      uptime: state.isBackendDown ? 0 : 12345,
    };
  },

  getDashboard: (): DashboardMetrics => {
    return {
      requests: state.requests,
      errors: state.errors,
      responseTime: state.isBackendDown ? 0 : state.responseTime,
      uptime: state.isBackendDown ? 87.4 : state.uptime,
    };
  },

  getRequestHistory: (): RequestMetricPoint[] => {
    return [...state.requestHistory];
  },

  getCpuHistory: (): CpuMetricPoint[] => {
    return [...state.cpuHistory];
  },

  getResponseTimeHistory: (): ResponseTimeMetricPoint[] => {
    return [...state.responseTimeHistory];
  },

  getRecentErrors: (): SystemErrorItem[] => {
    return [...state.recentErrors];
  },

  getServices: (): ServiceItem[] => {
    return [
      {
        id: 'srv-1',
        name: 'Backend API',
        status: state.isBackendDown ? 'Down' : state.isHighErrorRate ? 'Down' : 'Healthy',
        role: 'Processes application requests and business logic',
      },
      {
        id: 'srv-2',
        name: 'Database',
        status: 'Healthy',
        role: 'PostgreSQL storage for persistent data',
      },
      {
        id: 'srv-3',
        name: 'Prometheus',
        status: state.isBackendDown ? 'Down' : 'Collecting',
        role: 'Scrapes /metrics endpoint every 15 seconds',
      },
      {
        id: 'srv-4',
        name: 'Grafana',
        status: 'Connected',
        role: 'Visualizes historical metrics and time-series',
      },
    ];
  },

  getDatabaseStats: (): DatabaseStats => {
    return {
      connections: state.isBackendDown ? 0 : 24,
      queries: 8420,
      queryDuration: state.isSlowApi ? 145 : 12,
      databaseSize: '1.2 GB',
    };
  },

  getAlerts: (): AlertItem[] => {
    return [...state.activeAlerts];
  },

  getAlertConfig: (): AlertConfig => {
    return { ...state.alertConfig };
  },

  saveAlertConfig: (config: AlertConfig): AlertConfig => {
    state.alertConfig = { ...config };
    return { ...state.alertConfig };
  },

  getApiMetricsOverview: (): ApiMetricsOverview => {
    const errorRate = state.requests > 0 ? Number(((state.errors / state.requests) * 100).toFixed(1)) : 0;
    return {
      requests: state.requests,
      errors: state.errors,
      errorRate,
      responseTime: state.isBackendDown ? 0 : state.responseTime,
      throughput: state.isBackendDown ? 0 : Math.round(state.requests / 3600),
    };
  },

  checkUrl: (url: string): UrlCheckResult => {
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    return {
      url,
      status: 'UP',
      availability: 99.8,
      responseTime: isLocalhost ? 18 : 124,
      statusCode: 200,
      ssl: url.startsWith('https://') ? 'Valid' : 'Invalid',
      uptime: '14 days, 6 hours',
    };
  },

  simulateLoad: (count: number) => {
    state.requests += count;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    state.requestHistory = [
      ...state.requestHistory.slice(1),
      { time: timeStr, requests: state.requestHistory[state.requestHistory.length - 1].requests + count },
    ];
  },

  simulateErrors: () => {
    state.isHighErrorRate = true;
    state.errors += 420;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    state.recentErrors = [
      { id: `err-${Date.now()}-1`, status: 500, path: '/api/test/errors', timeAgo: 'just now' },
      { id: `err-${Date.now()}-2`, status: 502, path: '/api/v1/orders', timeAgo: '1 min ago' },
      ...state.recentErrors,
    ].slice(0, 10);

    const exists = state.activeAlerts.some((a) => a.id === 'alt-error');
    if (!exists) {
      state.activeAlerts = [
        {
          id: 'alt-error',
          severity: 'critical',
          title: 'HIGH ERROR RATE',
          message: 'Error rate has exceeded the configured threshold (currently 12.7%). Prometheus detected the error rate.',
          timestamp: timeStr,
          active: true,
        },
        ...state.activeAlerts,
      ];
    }
  },

  simulateSlow: () => {
    state.isSlowApi = true;
    state.responseTime = 860;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    state.responseTimeHistory = [
      ...state.responseTimeHistory.slice(1),
      { time: timeStr, responseTime: 860 },
    ];
  },

  simulateCpu: () => {
    state.isHighCpu = true;
    state.cpu = 91;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    state.cpuHistory = [
      ...state.cpuHistory.slice(1),
      { time: timeStr, cpu: 91 },
    ];
    const exists = state.activeAlerts.some((a) => a.id === 'alt-cpu');
    if (!exists) {
      state.activeAlerts = [
        {
          id: 'alt-cpu',
          severity: 'critical',
          title: 'HIGH CPU USAGE',
          message: 'CPU 91%, Duration 5 minutes',
          timestamp: timeStr,
          active: true,
        },
        ...state.activeAlerts,
      ];
    }
  },

  simulateStop: () => {
    state.isBackendDown = true;
    state.activeAlerts = [
      {
        id: 'alt-down',
        severity: 'critical',
        title: 'BACKEND DOWN',
        message: 'Prometheus cannot reach Backend service at backend:5000',
        timestamp: 'just now',
        active: true,
      },
      ...state.activeAlerts,
    ];
  },

  restoreSystem: () => {
    state = {
      isBackendDown: false,
      isHighCpu: false,
      isHighErrorRate: false,
      isSlowApi: false,
      requests: 15234,
      errors: 32,
      responseTime: 142,
      uptime: 99.9,
      cpu: 42,
      memory: 61,
      disk: 38,
      alertConfig: { ...initialAlertConfig },
      recentErrors: [...initialErrors],
      activeAlerts: [
        {
          id: 'alt-1',
          severity: 'warning',
          title: 'HIGH CPU USAGE',
          message: 'CPU 91%, Duration 5 minutes',
          timestamp: '10 mins ago',
          active: false,
        },
      ],
      requestHistory: [...initialRequestHistory],
      cpuHistory: [...initialCpuHistory],
      responseTimeHistory: [...initialResponseTimeHistory],
    };
  },
};

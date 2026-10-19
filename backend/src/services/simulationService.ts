import { Worker } from 'node:worker_threads';

interface SimulationState {
  errorMode: boolean;
  slowMode: boolean;
  simulatedDown: boolean;
  cpuWorkerActive: boolean;
}

const state: SimulationState = {
  errorMode: false,
  slowMode: false,
  simulatedDown: false,
  cpuWorkerActive: false,
};

export const simulationService = {
  isErrorMode: (): boolean => state.errorMode,
  isSlowMode: (): boolean => state.slowMode,
  isSimulatedDown: (): boolean => state.simulatedDown,
  isCpuWorkerActive: (): boolean => state.cpuWorkerActive,

  setErrorMode: (active: boolean): void => {
    state.errorMode = active;
  },

  setSlowMode: (active: boolean): void => {
    state.slowMode = active;
  },

  setSimulatedDown: (active: boolean): void => {
    state.simulatedDown = active;
  },

  triggerCpuWorkload: (durationSeconds: number = 20): void => {
    if (state.cpuWorkerActive) return;
    state.cpuWorkerActive = true;

    // Run CPU-intensive mathematical calculation inside a worker thread
    // to generate genuine CPU usage without freezing the main Express event loop
    const workerCode = `
      const { parentPort } = require('node:worker_threads');
      const endTime = Date.now() + (${durationSeconds} * 1000);
      while (Date.now() < endTime) {
        // Burn CPU cycles
        Math.sqrt(Math.random() * 1000000);
      }
      parentPort.postMessage('done');
    `;

    try {
      const worker = new Worker(workerCode, { eval: true });
      worker.on('message', () => {
        state.cpuWorkerActive = false;
        worker.terminate();
      });
      worker.on('error', (err: Error) => {
        console.error('[CPU Worker Error]', err.message);
        state.cpuWorkerActive = false;
        worker.terminate();
      });
    } catch (e) {
      console.error('[CPU Worker Launch Error]', e);
      state.cpuWorkerActive = false;
    }
  },

  restoreAll: (): void => {
    state.errorMode = false;
    state.slowMode = false;
    state.simulatedDown = false;
    state.cpuWorkerActive = false;
  },
};

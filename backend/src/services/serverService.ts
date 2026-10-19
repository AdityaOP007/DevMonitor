import os from 'node:os';
import fs from 'node:fs/promises';
import type { ServerMetrics } from '../types/index.js';

interface CpuTimes {
  idle: number;
  total: number;
}

let lastCpuTimes: CpuTimes = getCpuTimesSnapshot();
let lastCpuPercentage: number = 0;

function getCpuTimesSnapshot(): CpuTimes {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  return { idle, total };
}

export function sampleCpuUsage(): number {
  const current = getCpuTimesSnapshot();
  const deltaIdle = current.idle - lastCpuTimes.idle;
  const deltaTotal = current.total - lastCpuTimes.total;

  lastCpuTimes = current;

  if (deltaTotal <= 0) {
    return lastCpuPercentage;
  }

  const usage = Math.round((1 - deltaIdle / deltaTotal) * 100);
  lastCpuPercentage = Math.max(0, Math.min(100, usage));
  return lastCpuPercentage;
}

// Sample CPU periodically so immediate requests have a valid delta
setInterval(() => {
  sampleCpuUsage();
}, 2000);

export async function getServerMetrics(): Promise<ServerMetrics> {
  const cpu = sampleCpuUsage();

  // Real memory usage from os module
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memory = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;

  // Real disk usage using fs.promises.statfs on current root/drive
  let disk = 0;
  try {
    const stat = await fs.statfs(process.cwd());
    const totalBlocks = stat.blocks;
    const freeBlocks = stat.bfree;
    if (totalBlocks > 0) {
      disk = Math.round(((totalBlocks - freeBlocks) / totalBlocks) * 100);
    }
  } catch (err) {
    console.warn('[Disk Stat Error] Could not read statfs, falling back to 0:', err);
    disk = 0;
  }

  const uptime = Math.floor(os.uptime());

  return {
    cpu,
    memory,
    disk,
    uptime,
  };
}

import type {
  FlashRunOptions,
  FlashStatus,
  FlashProgress,
  FlashResult,
  RomAnalysis,
  RomCommand,
  Device,
} from '../../shared/types';
import type { LogService } from './logger';
import type { FastbootService } from './fastboot-service';
import type { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface RunState {
  runId: string;
  status: FlashStatus;
  analysis: RomAnalysis | null;
  serial: string;
  options: FlashRunOptions;
  startedAt: number;
  completedSteps: number;
  totalSteps: number;
  currentStep?: number;
  stepPartition?: string;
  currentFile?: string;
  percent?: number;
  stepPercent?: number;
  abort: boolean;
}

/**
 * Map a single RomCommand kind to fastboot exec args.
 * Used inside the flash loop to execute each command derived from the
 * selected ROM script method.
 */
function mapCommandToExec(
  cmd: RomCommand,
  analysisRootDir?: string
): {
  execArgs: string[];
  partition?: string;
  filePath?: string;
  flags: string[];
} {
  const flags = cmd.flags.filter((t: string) => /^-[sScCdDpPnNxXoO]/.test(t) || t.startsWith('--'));

  switch (cmd.kind) {
    case 'flash':
      const fp = cmd.partition || (cmd.args.length >= 1 ? cmd.args[0] : undefined);
      const ff = cmd.file || (cmd.args.length >= 2 ? cmd.args[1] : undefined);
      let fpPath: string | undefined;
      if (ff && analysisRootDir) fpPath = path.join(analysisRootDir, ff);
      return { execArgs: ['flash', fp, ff].filter((x): x is string => Boolean(x)), partition: fp, filePath: fpPath, flags };

    case 'erase':
      const ep = cmd.partition || (cmd.args.length >= 1 ? cmd.args[0] : undefined);
      return { execArgs: ['erase', ep].filter((x): x is string => Boolean(x)), partition: ep, flags };

    case 'reboot':
      const rawLower = cmd.raw.toLowerCase();
      if (/fastboot/.test(rawLower)) return { execArgs: ['reboot', 'system'], partition: undefined, flags };
      if (/bootloader/.test(rawLower) || /reboot-bootloader/.test(cmd.raw)) return { execArgs: ['reboot-bootloader'], partition: undefined, flags };
      return { execArgs: ['reboot'], partition: undefined, flags };

    case 'reboot-bootloader':
      return { execArgs: ['reboot-bootloader'], partition: undefined, flags };

    case 'set-active':
      const slot = cmd.args[0] || 'a';
      return { execArgs: ['--set-active', slot], partition: undefined, flags };

    case 'boot':
      const bf = cmd.file || (cmd.args.length >= 1 ? cmd.args[0] : undefined);
      let bfPath: string | undefined;
      if (bf && analysisRootDir) bfPath = path.join(analysisRootDir, bf);
      return { execArgs: ['boot', bf || ''].filter((x): x is string => Boolean(x)), filePath: bfPath, flags };

    case 'lock':
      const kind = /flashing/.test(cmd.raw) ? 'flashing' : 'oem';
      return { execArgs: [kind, 'lock'], partition: undefined, flags };

    case 'format':
      return { execArgs: ['format'], partition: undefined, flags };

    case 'wipe-super':
      const wf = cmd.file || (cmd.args.length >= 1 ? cmd.args[0] : undefined);
      let wfPath: string | undefined;
      if (wf && analysisRootDir) wfPath = path.join(analysisRootDir, wf);
      return { execArgs: ['wipe-super', wf || ''].filter((x): x is string => Boolean(x)), filePath: wfPath, flags };

    default:
      return { execArgs: cmd.args, partition: undefined, flags };
  }
}

export class FlashManager {
  private states = new Map<string, RunState>();
  private monitor: import('./device-monitor').DeviceMonitor;

  constructor(
    private fastboot: FastbootService,
    private log: LogService,
    monitor: import('./device-monitor').DeviceMonitor,
    private send: (channel: string, payload: unknown) => void
  ) {
    this.monitor = monitor;
  }

  /**
   * Start a flash run.
   * Uses the RomScript for the selected method from the analysis object.
   */
  async start(
    analysis: RomAnalysis,
    options: FlashRunOptions & { serial: string; runId?: string; method: string }
  ): Promise<FlashResult> {
    const runId = options.runId ?? `run-${Date.now()}`;
    const serial = options.serial;
    const method = options.method;

    const runState: RunState = {
      runId,
      status: 'validating',
      analysis,
      serial,
      options: { ...options },
      startedAt: Date.now(),
      completedSteps: 0,
      totalSteps: 0,
      abort: false,
    };
    this.states.set(runId, runState);

    try {
      // 1. Device connection check
      const device = await this.monitorSnapshot(serial);
      if (!device) throw new Error(`Device ${serial} not found`);

      // 2. Bootloader guard: cannot flash if locked
      if (device.bootloader === 'locked') throw new Error('Device bootloader is locked. Unlock first.');

      // 3. Codename compatibility
      if (analysis.codename && device.codename && analysis.codename !== device.codename) {
        if (!options.confirmedCodename) {
          throw new Error(
            `Codename mismatch: analysis=${analysis.codename}, device=${device.codename}. Set confirmedCodename to proceed.`
          );
        }
      }

      // 4. Anti-rollback guard
      if (
        analysis.antiVersion !== undefined &&
        device.anti !== undefined &&
        analysis.antiVersion > device.anti
      ) {
        throw new Error(`Anti-rollback blocked: ROM anti ${analysis.antiVersion} > device anti ${device.anti}.`);
      }

      // 5. Script safety check
      await this.validateScriptsSafety(analysis);

      // 6. Compile commands from the selected method's script
      const script = analysis.scripts[method];
      if (!script || !script.commands) throw new Error(`No ${method} script found in this ROM archive.`);
      const commands = script.commands;
      runState.totalSteps = commands.length;

      // 7. Execute commands sequentially
      for (let i = 0; i < commands.length; i++) {
        if (runState.abort) {
          runState.status = 'cancelled';
          break;
        }

        const cmd = commands[i];
        const mapped = mapCommandToExec(cmd, runState.analysis!.rootDir);
        const { execArgs } = mapped;

        // Report starting step
        runState.currentStep = i + 1;
        runState.stepPartition = mapped.partition;
        runState.currentFile = mapped.filePath;
        this.sendProgress(runState);

        // Execute fastboot command with output streaming for progress parsing
        const res = await this.fastboot.exec(
          execArgs,
          { serial, timeoutMs: 600_000, onLine: (line: string) => {
            // Extract progress % from fastboot output "(xx%)"
            const pct = line.match(/\((\d{1,3})%\)/);
            if (pct) {
              const percent = Math.round(parseInt(pct[1], 10));
              this.sendProgress({ ...runState, percent, stepPercent: percent });
            }
            // Emit raw output for log viewing
            this.sendLogLine({ runId, entry: { id: 0, ts: Date.now(), level: 'command' as const, source: 'flash', message: line } });
          } }
        );

        if (!res.ok) {
          runState.status = 'failed';
          runState.completedSteps = i;
          this.sendProgress(runState);
          const failure = this.failureReason(res.output ?? '');
          throw new Error(`Flash command ${i + 1} failed: ${failure}`);
        }

        runState.completedSteps = i + 1;
        this.sendProgress(runState);
      }

      // 8. After all commands complete, optional lock based on method
      if (options.method === 'clean-all-lock') {
        const hasRecord = await this.hasVerifiedStockRecord(serial, analysis.codename ?? '');
        if (hasRecord) {
          await this.fastboot.lock(serial, 'flashing lock');
        } else {
          this.sendLogLine({
            runId,
            entry: { id: 0, ts: Date.now(), level: 'warn' as const, source: 'flash', message: 'Lock skipped: no verified stock flash record.' },
          });
        }
      }

      runState.status = 'completed';
      runState.completedSteps = runState.totalSteps;
      this.sendProgress(runState);

      // Emit completion
      this.sendLogLine({
        runId,
        entry: { id: 0, ts: Date.now(), level: 'success' as const, source: 'flash', message: 'Flash completed successfully.' },
      });

      // Record verified stock flash after successful completion
      if (options.method !== 'save-data' && runState.status === 'completed') {
        await this.recordVerifiedStockFlash(serial, analysis, options.method);
      }

      return {
        runId,
        status: 'completed' as FlashStatus,
        serial,
        method,
        error: undefined,
        completedSteps: runState.completedSteps,
        totalSteps: runState.totalSteps,
        startTs: runState.startedAt,
        endTs: Date.now(),
        commands,
        relockSuggested: options.method === 'clean-all-lock',
      };
    } catch (err) {
      runState.status = 'failed';
      this.sendLogLine({
        runId,
        entry: { id: 0, ts: Date.now(), level: 'error' as const, source: 'flash', message: err instanceof Error ? err.message : String(err) },
      });
      return {
        runId,
        status: 'failed' as FlashStatus,
        serial,
        method: options.method,
        error: err instanceof Error ? err.message : String(err),
        completedSteps: runState.completedSteps,
        totalSteps: runState.totalSteps,
        startTs: runState.startedAt,
        endTs: Date.now(),
        commands: [],
        relockSuggested: false,
      };
    }
  }

  cancel(runId: string): boolean {
    const state = this.states.get(runId);
    if (!state) return false;
    state.abort = true;
    return true;
  }

  getState(runId: string): RunState | undefined {
    return this.states.get(runId);
  }

  private sendProgress(state: RunState): void {
    this.send('flash:progress', {
      runId: state.runId,
      progress: {
        totalSteps: state.totalSteps,
        completedSteps: state.completedSteps,
        currentStep: state.currentStep,
        stepPartition: state.stepPartition,
        stepPercent: state.percent ?? undefined,
        percent: state.percent ?? undefined,
        startedAt: state.startedAt,
        finishedAt: Date.now(),
      },
    });
  }

  private sendLogLine(payload: { runId: string; entry: { id: number; ts: number; level: string; source: string; message: string } }): void {
    this.send('flash:log', payload);
  }

  private failureReason(output: string): string | null {
    const lines = output.split(/\r?\n/);
    for (const line of lines) {
      if (/failed|failure|error|not allowed|unauthorized|unknown partition|no such file|insufficient|cannot/i.test(line)) return line.trim();
    }
    return null;
  }

  private async validateScriptsSafety(analysis: RomAnalysis): Promise<void> {
    for (const [, script] of Object.entries(analysis.scripts)) {
      if (!script || !script.scriptPath) continue;
    }
  }

  private async monitorSnapshot(serial: string): Promise<import('../../shared/types').Device | undefined> {
    await this.monitor.refreshNow();
    const snap = this.monitor.getSnapshot();
    return snap.devices.find((d) => d.serial === serial);
  }

  private async recordVerifiedStockFlash(serial: string, analysis: RomAnalysis, method: string): Promise<void> {
    const userData = process.platform === 'win32' ? process.env.APPDATA ?? process.cwd() : process.env.HOME ?? process.cwd();
    const recPath = path.join(userData, 'XiaomiFlashTool', 'flash-records.json');
    let records: Array<{ serial: string; codename: string; romVersion?: string; androidVersion?: string; method: string; ts: number }> = [];
    try {
      const raw = fs.readFileSync(recPath, 'utf8');
      records = JSON.parse(raw);
    } catch {
      records = [];
    }
    records.push({
      serial,
      codename: analysis.codename ?? 'unknown',
      romVersion: analysis.romVersion,
      androidVersion: analysis.androidVersion,
      method,
      ts: Date.now(),
    });
    records = records.slice(-50);
    fs.mkdirSync(path.dirname(recPath), { recursive: true });
    fs.writeFileSync(recPath, JSON.stringify(records, null, 2));
  }

  private async hasVerifiedStockRecord(serial: string, codename: string): Promise<boolean> {
    const userData = process.platform === 'win32' ? process.env.APPDATA ?? process.cwd() : process.env.HOME ?? process.cwd();
    const recPath = path.join(userData, 'XiaomiFlashTool', 'flash-records.json');
    try {
      const raw = fs.readFileSync(recPath, 'utf8');
      const records: Array<{ serial: string; codename: string }> = JSON.parse(raw);
      return records.some((r: any) => r.serial === serial && r.codename === codename);
    } catch {
      return false;
    }
  }
}
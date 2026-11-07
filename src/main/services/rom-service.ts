import { runCommand } from './command-runner';
import { LogService } from './logger';
import type {
  FlashMethod,
  RomAnalysis,
  RomCommand,
  RomCommandKind,
  RomIssue,
  RomScript,
} from '../../shared/types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';


const FLASH_METHODS: FlashMethod[] = ['clean-all', 'save-data', 'clean-all-lock'];

const ARCHIVE_SCRIPT_NAMES: Record<FlashMethod, string[]> = {
  'clean-all': ['flash_all.bat', 'flash_all.sh'],
  'save-data': ['flash_all_except_storage.bat', 'flash_all_except_storage.sh'],
  'clean-all-lock': ['flash_all_lock.bat', 'flash_all_lock.sh'],
};

const RECOVERY_META = 'META-INF/com/google/android/updater-script';


type ArchiveEntry = { name: string; size?: number; type: 'file' | 'directory' | 'other' };

/** List archive entries using system tar -tf (works on .tgz and many .zip). */
async function listViaTar(archivePath: string): Promise<ArchiveEntry[]> {
  return new Promise((resolve) => {
    const proc = spawn('tar', ['-tf', archivePath], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code !== 0) return resolve([]);
      const lines = stdout.split('\n').filter((l) => l.trim());
      const out: ArchiveEntry[] = lines.map((l) => {
        const name = l.replace(/\\/g, '/').trim();
        return { name, size: undefined, type: name.includes('/') && !name.endsWith('/') ? 'file' : 'directory' };
      });
      resolve(out);
    });
  });
}

/** Check if any listed entry touches recovery meta. */
function hasRecoveryMeta(entries: ArchiveEntry[]): boolean {
  return entries.some((e) => e.name.toLowerCase().includes(RECOVERY_META.toLowerCase()));
}

/** Extract archive (tgz or zip) into temp dir. */
async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn('tar', ['-xf', archivePath, '-C', destDir, '--force-local'], {
      windowsHide: true,
    });
    p.on('close', (code) => {
      if (code === 0) return resolve();
      // fall back to unzip on Linux
      if (process.platform !== 'win32') {
        const p2 = spawn('unzip', ['-o', '-q', archivePath], { cwd: destDir, windowsHide: true });
        p2.on('close', (c) => c === 0 ? resolve() : reject(new Error('extraction failed')));
        p2.on('error', reject);
      } else reject(new Error('extraction failed'));
    });
    p.on('error', reject);
  });
}

/** Walk dir and return all file paths relative to base, skipping symlinks with .. */
function walkDir(base: string): string[] {
  const out: string[] = [];
  try {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      const full = path.join(base, entry.name);
      if (entry.isDirectory()) out.push(...walkDir(full));
      else if (entry.isFile()) out.push(full);
    }
  } catch {}
  return out;
}

/** Tokenize a shell / bat line respecting single and double quotes and literal backslash. */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQ = false;
  let quoteChar: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === quoteChar) inQ = false;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQ = true;
      quoteChar = ch;
      continue;
    }
    if (ch === '\\' && i + 1 < line.length) {
      const nxt = line[i + 1];
      if (nxt === quoteChar || nxt === '\\') {
        current += nxt;
        i++;
        continue;
      }
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) { tokens.push(current); current = ''; }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

/** Scan raw script text for codename embedded in findstr/grep product check. */
function extractCodenameFromScript(raw: string): string | null {
  const patterns = [
    /findstr\s+\/r\s+\/c:\"?\^?product:\s*\*?([A-Za-z0-9_]+)/i,
    /grep\s+\"?\^?product:\s*\*?([A-Za-z0-9_]+)/i,
    /findstr\s+\"?product:\s*([A-Za-z0-9_]+)/i,
    /product:\s*([A-Za-z0-9_]+)/i,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

/** Scan raw script text for anti-version. */
function extractAntiFromScript(raw: string): number | undefined {
  const m = raw.match(/anti[_-]?version[=:]\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Android version from filename like `_13.0_`. */
function extractAndroidFromFilename(filename: string): string | null {
  const m = filename.match(/_(\d{1,2})\.\d_/);
  return m ? m[1] : null;
}

/** Region from filename patterns: cmi_global_images, cmi_cn_images, etc. */
function extractRegionFromFilename(filename: string): string | null {
  const m = filename.match(/_([a-z]{2,7})_images_/i);
  return m ? m[1] : null;
}

/** Android version from filename like `V14.0.5.0.TJKMIXM`. */
function extractVersionFromFilename(filename: string): string | null {
  const m = filename.match(/V\d+(?:\.\d+)+(?:[A-Z0-9]+)/i);
  return m ? m[0] : null;
}


/**
 * Derive a RomScript from available scripts in an extracted or raw archive.
 * Also extracts codename, version, anti, region.
 */
function deriveRomScript(
  rootDir: string | undefined,
  archivePath: string,
  filename: string,
  log: LogService
): Record<FlashMethod, RomScript | null> {
  const base = path.basename(filename).replace(/\.(tgz|zip|tar\.gz)$/i, '');
  const codename = extractCodenameFromFilename(base) || undefined;
  // read anti from script if file exists
  const antiPath = rootDir ? path.join(rootDir, 'images', 'anti_version.txt') : undefined;
  const anti = antiPath && fs.existsSync(antiPath)
    ? extractAntiFromScript(fs.readFileSync(antiPath, 'utf8'))
    : undefined;
  const android = extractAndroidFromFilename(filename);
  const region = extractRegionFromFilename(filename);
  const version = extractVersionFromFilename(filename);

  const result: Record<FlashMethod, RomScript | null> = {
    'clean-all': null,
    'save-data': null,
    'clean-all-lock': null,
  };

  // Try parsing each script file if present
  for (const [method, names] of Object.entries(ARCHIVE_SCRIPT_NAMES) as [FlashMethod, string[]][]) {
    let foundScript = false;
    for (const name of names) {
      const fp = rootDir ? path.join(rootDir, name) : name;
      if (fs.existsSync(fp)) {
        const cmds = parseScriptFile(fp);
        if (cmds.length > 0) {
          const lockM = fs.readFileSync(fp, 'utf8').match(/fastboot\s+(?:oem|flashing)\s+lock/i);
          result[method] = {
            name: path.basename(fp),
            source: 'script',
            scriptPath: fp,
            commands: cmds,
            lockCommand: lockM ? lockM[0] : undefined,
          };
          foundScript = true;
          break;
        }
      }
    }
    // If no script found but we have a clean-all derived from any present bat/sh, derive save-data and clean-all-lock
    if (!foundScript && method === 'clean-all' && rootDir) {
      const allScripts = walkDir(rootDir).filter(f => /flash_all\.(bat|sh)$/i.test(path.basename(f)));
      if (allScripts.length > 0) {
        const first = allScripts[0];
        const cmds = parseScriptFile(first);
        if (cmds.length > 0) {
          // derive save-data: keep only commands not referencing userdata, cache, metadata, or -w flag
          const filtered = cmds.filter(c => {
            const s = (c.raw || '').toLowerCase();
            return !/userdata|cache|metadata|-w\b/.test(s);
          });
          if (filtered.length > 0) {
            result['save-data'] = {
              name: path.basename(first),
              source: 'derived',
              scriptPath: first,
              commands: filtered,
              lockCommand: undefined,
            };
          }
          // derive clean-all-lock: append lock command at end
          const lockCmd: RomCommand = {
            kind: 'lock',
            raw: 'fastboot oem lock',
            partition: undefined,
            file: undefined,
            fileSize: undefined,
            flags: [],
            args: ['oem', 'lock'],
            display: 'fastboot oem lock',
            line: 0,
            source: 'derived',
            derived: true,
          };
          result['clean-all-lock'] = {
            name: path.basename(first),
            source: 'derived',
            scriptPath: first,
            commands: [...cmds, lockCmd],
            lockCommand: 'oem lock',
          };
        }
      }
    }
  }

  return result;
}

/**
 * Parse a .bat or .sh script into an array of RomCommand entries.
 * Whitelists allowed operation kinds and rejects pipes/redirects/shell ops.
 */
function parseScriptFile(filePath: string): RomCommand[] {
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  const commands: RomCommand[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments, echo, REM, etc.
    if (
      !trimmed ||
      /^@echo\s+off|^::|^REM\b|^#/i.test(trimmed) ||
      /^\s*echo\s/.test(trimmed) ||
      /^\s*pause\b/i.test(trimmed) ||
      /^\s*set\s/.test(trimmed) ||
      /^\s*if\b/i.test(trimmed) ||
      /^\s*for\b/i.test(trimmed) ||
      /^\s*exit\b/i.test(trimmed) ||
      /^\s*goto\b/i.test(trimmed) ||
      /^\s*cd\b/i.test(trimmed) ||
      /^\s*del\b/i.test(trimmed) ||
      /^\s*rd\b/i.test(trimmed) ||
      /^\s*mkdir\b/i.test(trimmed) ||
      /^\s*call\b/i.test(trimmed)
    ) {
      continue;
    }

    // Reject shell operators: pipes, redirections, &&, ||
    if (/[|&<>;]/.test(trimmed)) continue;

    // Must start with fastboot (bat) or fastboot (sh)
    const m = trimmed.match(/^(fastboot|fastboot\.exe)\s+(.*)$/i);
    if (!m) continue;

    const argsPart = m[2].trim();
    // Remove %* and $* tokens
    let cleaned = argsPart.replace(/%\*/gi, '').replace(/\$\*/gi, '');

    // Basic reject if contains backtick or dollar braced vars ${} after strip
    if (/\\\$\([^)]+\)/.test(cleaned)) continue;

    const tokens = tokenize(cleaned);
    if (tokens.length === 0) continue;

    const cmd = tokens[0].toLowerCase();
    const rest = tokens.slice(1);

    // Determine kind
    let kind: RomCommandKind = 'other';
    let partition: string | undefined;
    let file: string | undefined;

    if (cmd === 'flash') {
      // First token after fastboot may be partition; last non-flag token may be file
      const allowedPart = rest.find((t) => /^[a-zA-Z0-9_.-]+$/.test(t) && t.length >= 1);
      if (allowedPart) {
        partition = allowedPart;
        // file is the last non-flag token
        const nonFlags = rest.filter((t) => !/^-[sScCdDpPnNxXoO]=?/.test(t) && !t.startsWith('-'));
        if (nonFlags.length >= 2) file = nonFlags[nonFlags.length - 1];
      }
      kind = 'flash';
    }

    else if (cmd === 'erase') {
      const allowedPart = rest.find((t) => /^[a-zA-Z0-9_.-]+$/.test(t));
      if (allowedPart) partition = allowedPart;
      kind = 'erase';
    }

    else if (cmd === 'reboot') {
      if (/fastboot/i.test(rest.join(' '))) kind = 'reboot';
      else kind = 'reboot-bootloader';
    }

    else if (cmd === 'set-active' || cmd === '--set-active') {
      if (rest.length >= 1) kind = 'set-active';
    }

    else if (cmd === 'boot') {
      if (rest.length >= 1) {
        file = rest[0];
        kind = 'boot';
      }
    }

    else if (cmd === 'oem') {
      if (/lock/i.test(rest.join(' '))) kind = 'lock';
      else kind = 'other';
    }

    else if (cmd === 'flashing') {
      if (/lock/i.test(rest.join(' '))) kind = 'lock';
      else kind = 'other';
    }

    else if (cmd === 'format') {
      kind = 'format';
    }

    else if (/delete-logical-partition|create-logical-partition|resize-logical-partition|wipe-super/i.test(cmd)) {
      kind = 'wipe-super';
    }

    else {
      continue;
    }

    // Build command object
    if (kind === 'other' && !['flash', 'erase', 'reboot', 'reboot-bootloader', 'set-active', 'boot', 'lock', 'format', 'wipe-super'].includes(kind)) {
      continue;
    }

    const cmdObj: RomCommand = {
      kind,
      raw: trimmed,
      partition,
      file,
      fileSize: undefined,
      flags: rest.filter((t) => /^-[sScCdDpPnNxXoO]/.test(t) || t.startsWith('--')),
      args: rest,
      display: trimmed,
      line: i + 1,
      source: 'parsed',
      derived: true,
    };
    commands.push(cmdObj);
  }

  return commands;
}

/**
 * Build a RomAnalysis from an archive path.
 */
export async function analyzeArchive(archivePath: string, log: LogService, tempDir?: string): Promise<RomAnalysis> {
  const id = path.basename(archivePath, path.extname(archivePath));
  const size = fs.statSync(archivePath).size;
  const format = /\.tgz$/i.test(archivePath) ? 'tgz' : /\.zip$/i.test(archivePath) ? 'zip' : 'unknown';
  const filename = path.basename(archivePath);

  // Detect recovery quickly via tar listing (no full extraction needed)
  let entries: ArchiveEntry[] = [];
  try {
    entries = await listViaTar(archivePath);
  } catch {
    entries.length = 0;
  }

  const hasRecovery = hasRecoveryMeta(entries);
  const codename = extractCodenameFromFilename(filename) || undefined;
  const android = extractAndroidFromFilename(filename) || undefined;
  const region = extractRegionFromFilename(filename) || undefined;
  const version = extractVersionFromFilename(filename) || undefined;
  const anti: number | undefined = undefined;

  let rootDir: string | undefined = undefined;
  let extracted = false;
  const notes: string[] = [];

  if (hasRecovery) {
    return {
      id,
      archivePath,
      filename,
      format,
      sizeBytes: size,
      kind: 'recovery',
      rootDir: undefined,
      extracted: false,
      extractionProgress: undefined,
      codename,
      androidVersion: android,
      region,
      antiVersion: undefined,
      files: entries.map((e) => e.name),
      images: [],
      body: {},
      responses: [],
      notes: ['Recovery ROM detected — use ADB Sideload.'],
      scripts: { 'clean-all': null, 'save-data': null, 'clean-all-lock': null },
      issues: [{ severity: 'info', code: 'RECOVERY_ROM', message: 'This ROM requires sideload to recovery; no fastboot script detected.' }],
    };
  }

  if (format === 'tgz') {
    const targetDir = tempDir ?? path.join(os.tmpdir(), `xf_${id}_${Date.now()}`);
    try {
      await fs.promises.mkdir(targetDir, { recursive: true });
      await extractArchive(archivePath, targetDir);
      rootDir = targetDir;
      extracted = true;
      // After extraction, collect files & images
    } catch (e) {
      log.log('error', 'rom', `Extraction error: ${(e as Error).message}`);
      // fall through to metadata-only analysis
    }
  } else {
    // zip without recovery → attempt tar listing for entries only; no extraction needed for analysis
    // If entries empty, try to list via tar fallback
    if (entries.length === 0) {
      try {
        entries = await listViaTar(archivePath);
      } catch {
        entries.length = 0;
      }
    }
  }

  // If not extracted, fallback analysis from filename metadata
  const scriptMap = deriveRomScript(rootDir, archivePath, filename, log);

  const files = rootDir ? walkDir(rootDir).map(f => path.relative(rootDir, f)).filter(f => !/^\.$/.test(f)) : entries.map(e => e.name);
  const images = rootDir ? files.filter(f => /\.img$/i.test(f) || /\.bin$/i.test(f) || /\.img\.gz$/i.test(f)) : [];

  return {
    id,
    archivePath,
    filename,
    format,
    sizeBytes: size,
    kind: 'fastboot',
    rootDir,
    extracted,
    extractionProgress: extracted ? 100 : undefined,
    codename,
    androidVersion: android,
    region,
    antiVersion: anti,
    files,
    images,
    body: {},
    responses: [],
    notes,
    scripts: scriptMap,
    issues: [],
  };
}

/** Export codename from basename patterns like XXXX_images_YYYY */
function extractCodenameFromFilename(base: string): string | null {
  // patterns: cmi_global_images_... → cmi
  //           zeus_global_images_... → zeus
  const m = base.match(/^([a-zA-Z0-9_.-]+?)_(?:[a-z]{2,7})?images_/i);
  if (m) return m[1];
  // fallback: just first token before _images_
  const m2 = base.match(/^([a-zA-Z0-9_.-]+?)_/i);
  if (m2) return m2[1];
  return null;
}


export type { FlashMethod, RomAnalysis, RomIssue, ArchiveEntry };
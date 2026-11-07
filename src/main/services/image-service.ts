import type { AndroidImageInfo } from '../../shared/types';
import * as fs from 'node:fs';

/**
 * Inspect the first bytes of an image file to identify its format.
 * Returns AndroidImageInfo used by the Image & Partition page.
 */
export function analyzeImage(imagePath: string): AndroidImageInfo {
  const name = imagePath.split(/[\\/]/).pop() ?? imagePath;
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(imagePath).size;
  } catch {
    // ignore
  }

  let magic = '';
  let format: AndroidImageInfo['format'] = 'unknown';
  const notes: string[] = [];

  try {
    const fd = fs.openSync(imagePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);

    if (bytesRead > 0) {
      const head = buf.subarray(0, bytesRead);

      // Android boot image: magic "ANDROID!"
      if (head.subarray(0, 8).toString('ascii') === 'ANDROID!') {
        format = 'android-boot';
        magic = 'ANDROID!';
        notes.push('Android boot/bootloader image (bootimg header).');
      }
      // ext4 sparse image magic 0xED26FF3A (LE bytes: 3a ff 26 ed)
      else if (head[0] === 0x3a && head[1] === 0xff && head[2] === 0x26 && head[3] === 0xed) {
        format = 'sparse';
        magic = '3aed26ff';
        notes.push('Android sparse image — flash directly with fastboot.');
      }
      // gzip magic
      else if (head[0] === 0x1f && head[1] === 0x8b) {
        format = 'gzip';
        magic = '1f8b';
        notes.push('Gzip-compressed payload.');
      }
      // zip magic
      else if (head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)) {
        format = 'zip';
        magic = 'PK';
        notes.push('Zip archive.');
      }
      // ext4 magic 0xEF53 at offset 0x438
      else if (bytesRead > 0x438 + 2 && buf[0x438] === 0x53 && buf[0x439] === 0xef) {
        format = 'ext4';
        magic = 'ef53@0x438';
        notes.push('Raw ext4 filesystem image.');
      } else {
        format = 'raw';
        notes.push('Unrecognized header — treated as raw payload.');
      }
    }
  } catch (e) {
    notes.push(`Read error: ${(e as Error).message}`);
  }

  return { path: imagePath, name, sizeBytes, format, magic: magic || undefined, notes };
}

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MAX_UPLOAD_SIZE_BYTES } from '@social/shared';
import sharp from 'sharp';
import type { EnvironmentVariables } from '../config/env';
import { UploadsService } from './uploads.service';

function fakeFile(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  const buffer = overrides.buffer ?? Buffer.from('not-really-an-image');
  return {
    buffer,
    size: buffer.length,
    mimetype: 'image/png',
    originalname: 'test.png',
    fieldname: 'file',
    encoding: '7bit',
    ...overrides,
  } as Express.Multer.File;
}

async function pngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#336699' } }).png().toBuffer();
}

describe('UploadsService.store', () => {
  let uploadsDir: string;
  let service: UploadsService;

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'social-uploads-'));
    const configServiceMock = {
      get: () => uploadsDir,
    } as unknown as ConfigService<EnvironmentVariables, true>;
    service = new UploadsService(configServiceMock);
  });

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('rejette un upload sans fichier', async () => {
    await expect(service.store(undefined)).rejects.toThrow(BadRequestException);
  });

  it('rejette un type MIME non supporté', async () => {
    await expect(service.store(fakeFile({ mimetype: 'text/plain' }))).rejects.toThrow(
      BadRequestException,
    );
    expect(await readdir(uploadsDir)).toHaveLength(0);
  });

  it('rejette un fichier trop volumineux', async () => {
    const file = fakeFile({ mimetype: 'image/png' });
    file.size = MAX_UPLOAD_SIZE_BYTES + 1;

    await expect(service.store(file)).rejects.toThrow(BadRequestException);
    expect(await readdir(uploadsDir)).toHaveLength(0);
  });

  it('écrit le fichier et une miniature, renvoie les métadonnées', async () => {
    const buffer = await pngBuffer(100, 50);

    const result = await service.store(fakeFile({ buffer, mimetype: 'image/png' }));

    expect(result.mime).toBe('image/png');
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
    expect(result.thumbUrl).toMatch(/^\/uploads\/[0-9a-f-]+-thumb\.webp$/);

    const files = await readdir(uploadsDir);
    expect(files).toHaveLength(2);
    expect(files).toContain(result.url.replace('/uploads/', ''));
    expect(files).toContain(result.thumbUrl?.replace('/uploads/', ''));
  });

  it('réduit une image plus grande que la miniature max', async () => {
    const buffer = await pngBuffer(800, 400);

    const result = await service.store(fakeFile({ buffer, mimetype: 'image/png' }));

    const thumbPath = join(uploadsDir, result.thumbUrl!.replace('/uploads/', ''));
    const thumbMetadata = await sharp(thumbPath).metadata();
    expect(thumbMetadata.width).toBeLessThanOrEqual(320);
    expect(thumbMetadata.height).toBeLessThanOrEqual(320);
  });
});

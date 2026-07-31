import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  type AllowedUploadMimeType,
  type UploadResultDto,
} from '@social/shared';
import sharp from 'sharp';
import type { EnvironmentVariables } from '../config/env';

const MIME_EXTENSIONS: Record<AllowedUploadMimeType, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

// Miniature carrée max, format webp (poids réduit) : suffisant pour une
// grille de galerie (M5-T3). Les GIF animés produisent une miniature
// statique (sharp ne lit que la première frame hors option `animated`),
// conformément à SPEC.md §6.
const THUMBNAIL_MAX_DIMENSION = 320;

function isAllowedMimeType(mime: string): mime is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mime);
}

@Injectable()
export class UploadsService {
  private readonly uploadsDir: string;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.uploadsDir = resolve(process.cwd(), configService.get('UPLOADS_DIR', { infer: true }));
  }

  async store(file: Express.Multer.File | undefined): Promise<UploadResultDto> {
    if (!file) {
      throw new BadRequestException('Fichier manquant');
    }
    if (!isAllowedMimeType(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non supporté : "${file.mimetype}" (attendu : ${ALLOWED_UPLOAD_MIME_TYPES.join(', ')})`,
      );
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException(
        `Fichier trop volumineux (${file.size} octets, max ${MAX_UPLOAD_SIZE_BYTES})`,
      );
    }

    await mkdir(this.uploadsDir, { recursive: true });

    const id = randomUUID();
    const filename = `${id}${MIME_EXTENSIONS[file.mimetype]}`;
    const thumbFilename = `${id}-thumb.webp`;

    const metadata = await sharp(file.buffer).metadata();
    const thumbBuffer = await sharp(file.buffer)
      .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp()
      .toBuffer();

    await Promise.all([
      writeFile(join(this.uploadsDir, filename), file.buffer),
      writeFile(join(this.uploadsDir, thumbFilename), thumbBuffer),
    ]);

    return {
      url: `/uploads/${filename}`,
      thumbUrl: `/uploads/${thumbFilename}`,
      mime: file.mimetype,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  }
}

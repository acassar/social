import { Controller, HttpCode, HttpStatus, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadResultDto } from '@social/shared';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService } from './uploads.service';

// Upload générique de fichier (M5-T1) : ne crée ni post ni attachment,
// renvoie juste où le fichier a été stocké. M5-T2 enchaînera cet appel
// avec `POST /channels/:id/posts` (type `memes`) pour créer le post et sa
// ligne `attachments`. Réservé aux membres authentifiés (pas de vérification
// de group ici, faite au moment de créer le post qui référence le fichier).
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(@UploadedFile() file: Express.Multer.File): Promise<UploadResultDto> {
    return this.uploadsService.store(file);
  }
}

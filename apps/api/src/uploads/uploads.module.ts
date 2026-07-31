import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

// Stockage de fichiers sur disque (M5-T1). Consommé par le futur module de
// posts `memes` (M5-T2), qui appellera UploadsService après avoir reçu le
// fichier — ou passera par POST /uploads puis référencera l'URL renvoyée.
@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}

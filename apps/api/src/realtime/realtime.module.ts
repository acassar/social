import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';

// Contrat d'événements temps réel (M2-T3) pas encore défini : ce module ne
// porte pour l'instant que le handshake authentifié + le join des rooms.
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway, WsJwtGuard],
})
export class RealtimeModule {}

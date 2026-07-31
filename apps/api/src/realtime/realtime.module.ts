import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeEventsService } from './realtime-events.service';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway, WsJwtGuard, RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}

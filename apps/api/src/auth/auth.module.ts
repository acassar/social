import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MeController } from './me.controller';

@Module({
  // Pas de secret par défaut au niveau du module : access et refresh tokens
  // utilisent des secrets/durées distincts, passés explicitement à chaque
  // sign/verify (voir AuthService, JwtAuthGuard).
  imports: [JwtModule.register({})],
  controllers: [AuthController, MeController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}

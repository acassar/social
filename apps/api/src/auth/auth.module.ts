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
  // JwtModule est réexporté : `@UseGuards(JwtAuthGuard)` fait instancier le
  // guard dans le contexte du module hôte (channels, posts, uploads, ...),
  // qui doit donc pouvoir résoudre JwtService lui-même.
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}

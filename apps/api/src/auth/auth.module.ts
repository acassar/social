import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Login/JWT/refresh (M1-T2) et guard/@CurrentUser() arriveront ici ensuite.
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

import { Controller, Get, UseGuards } from '@nestjs/common';
import type { MeResponseDto } from '@social/shared';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { CurrentUserPayload } from './jwt-payload';

// Route de premier niveau (`GET /me`, pas `/auth/me`) : contrôleur dédié
// sans préfixe pour respecter le contrat du backlog M1-T2.
@Controller()
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserPayload): Promise<MeResponseDto> {
    return this.authService.me(user.id);
  }
}

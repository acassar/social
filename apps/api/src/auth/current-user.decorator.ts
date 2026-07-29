import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestWithUser } from './jwt-auth.guard';
import type { CurrentUserPayload } from './jwt-payload';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      // @CurrentUser() n'a de sens que derrière JwtAuthGuard, qui peuple
      // request.user — l'utiliser sans le guard est une erreur de câblage.
      throw new InternalServerErrorException(
        '@CurrentUser() utilisé sans JwtAuthGuard : request.user absent',
      );
    }
    return request.user;
  },
);

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../config/env';
import { JwtAuthGuard, RequestWithUser } from './jwt-auth.guard';

const ACCESS_SECRET = 'access-secret';

function createContext(authorization?: string): ExecutionContext {
  const request = { headers: { authorization } } as RequestWithUser;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(): { guard: JwtAuthGuard; jwtService: JwtService } {
  const jwtService = new JwtService();
  const configService = {
    get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return { guard: new JwtAuthGuard(jwtService, configService), jwtService };
}

describe('JwtAuthGuard', () => {
  it('rejette (401) une requête sans en-tête Authorization', async () => {
    const { guard } = createGuard();
    await expect(guard.canActivate(createContext(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejette (401) un en-tête Authorization qui n'est pas un Bearer token", async () => {
    const { guard } = createGuard();
    await expect(guard.canActivate(createContext('Basic abc123'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejette (401) un token invalide/expiré', async () => {
    const { guard } = createGuard();
    await expect(
      guard.canActivate(createContext('Bearer not-a-valid-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte un token valide et peuple request.user', async () => {
    const { guard, jwtService } = createGuard();
    const token = await jwtService.signAsync({ sub: 'user-1' }, { secret: ACCESS_SECRET });
    const context = createContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest<RequestWithUser>().user).toEqual({ id: 'user-1' });
  });
});

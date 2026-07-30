import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { EnvironmentVariables } from '../config/env';
import { WsJwtGuard } from './ws-jwt.guard';

const ACCESS_SECRET = 'access-secret';

function createSocket(handshake: Partial<Socket['handshake']>): Socket {
  return {
    handshake: { auth: {}, headers: {}, ...handshake },
    data: {},
  } as unknown as Socket;
}

function createGuard(): { guard: WsJwtGuard; jwtService: JwtService } {
  const jwtService = new JwtService();
  const configService = {
    get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return { guard: new WsJwtGuard(jwtService, configService), jwtService };
}

describe('WsJwtGuard', () => {
  it('rejette une connexion sans token (auth ni header)', async () => {
    const { guard } = createGuard();
    await expect(guard.authenticate(createSocket({}))).rejects.toBeInstanceOf(WsException);
  });

  it("rejette un en-tête Authorization qui n'est pas un Bearer token", async () => {
    const { guard } = createGuard();
    const socket = createSocket({ headers: { authorization: 'Basic abc123' } });
    await expect(guard.authenticate(socket)).rejects.toBeInstanceOf(WsException);
  });

  it('rejette un token invalide/expiré', async () => {
    const { guard } = createGuard();
    const socket = createSocket({ auth: { token: 'not-a-valid-token' } });
    await expect(guard.authenticate(socket)).rejects.toBeInstanceOf(WsException);
  });

  it('accepte un token valide passé via handshake.auth.token', async () => {
    const { guard, jwtService } = createGuard();
    const token = await jwtService.signAsync({ sub: 'user-1' }, { secret: ACCESS_SECRET });
    const socket = createSocket({ auth: { token } });

    await expect(guard.authenticate(socket)).resolves.toEqual({ id: 'user-1' });
  });

  it("accepte un token valide passé via l'en-tête Authorization (fallback)", async () => {
    const { guard, jwtService } = createGuard();
    const token = await jwtService.signAsync({ sub: 'user-1' }, { secret: ACCESS_SECRET });
    const socket = createSocket({ headers: { authorization: `Bearer ${token}` } });

    await expect(guard.authenticate(socket)).resolves.toEqual({ id: 'user-1' });
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../auth/dto/login.dto';
import { RegisterDto } from '../auth/dto/register.dto';

describe('@Trim', () => {
  it('retire les espaces autour du pseudo au login', () => {
    const dto = plainToInstance(LoginDto, {
      displayName: '  Dev Owner  ',
      password: 'devpassword',
    });
    expect(dto.displayName).toBe('Dev Owner');
  });

  it('laisse le mot de passe intact', () => {
    const dto = plainToInstance(LoginDto, { displayName: 'Dev Owner', password: ' secret ' });
    expect(dto.password).toBe(' secret ');
  });

  it("retire les espaces autour du pseudo et du code à l'inscription", () => {
    const dto = plainToInstance(RegisterDto, {
      inviteCode: ' ABC123 ',
      displayName: ' Neu ',
      nativeLang: 'de',
      password: 'motdepasse',
    });
    expect(dto.inviteCode).toBe('ABC123');
    expect(dto.displayName).toBe('Neu');
  });

  it("rejette un pseudo fait uniquement d'espaces (400, pas 401)", async () => {
    const dto = plainToInstance(LoginDto, { displayName: '   ', password: 'devpassword' });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('displayName');
  });
});

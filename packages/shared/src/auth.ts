export type NativeLang = 'fr' | 'de';

export interface RegisterRequestDto {
  inviteCode: string;
  displayName: string;
  nativeLang: NativeLang;
  password: string;
}

export interface RegisterResponseDto {
  id: string;
  displayName: string;
  nativeLang: NativeLang;
  groupId: string;
}

export interface LoginRequestDto {
  displayName: string;
  password: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequestDto {
  refreshToken: string;
}

export interface AccessTokenDto {
  accessToken: string;
}

export interface MeResponseDto {
  id: string;
  displayName: string;
  nativeLang: NativeLang;
  avatarUrl?: string;
}

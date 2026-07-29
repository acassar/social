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

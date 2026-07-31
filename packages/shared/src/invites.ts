export interface CreateInviteRequestDto {
  expiresAt?: string;
}

export interface InviteDto {
  id: string;
  code: string;
  groupId: string;
  createdById: string;
  expiresAt: string | null;
  usedById: string | null;
  createdAt: string;
}

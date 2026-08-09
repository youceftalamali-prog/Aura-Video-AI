import type { UUID, ISODateString, Timestamps } from './common';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace extends Timestamps {
  id: UUID;
  name: string;
  slug: string;
  ownerId: UUID;
  logoUrl: string | null;
  isPersonal: boolean;
}

export interface WorkspaceMember {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  role: WorkspaceRole;
  invitedAt: ISODateString | null;
  joinedAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
  isPersonal?: boolean;
}

export interface UpdateWorkspaceInput {
  name?: string;
  logoUrl?: string | null;
}

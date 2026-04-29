export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: UserProfile;
};

export type DocumentListItem = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type NoteDocument = DocumentListItem & {
  user_id: string;
  content_json: Record<string, unknown>;
};

export type SearchResult = {
  document_id: string;
  document_title: string;
  chunk_index: number;
  chunk_text: string;
  score: number;
  content_json: Record<string, unknown>;
};

export type Collaborator = {
  connection_id: string;
  id: string;
  name: string;
  avatar_color: string;
};

export type CursorPayload = {
  type: 'cursor';
  user: Collaborator;
  blockId?: string;
  position?: number;
};

export type BlockUpdatePayload = {
  type: 'block_update';
  documentId: string;
  content_json: Record<string, unknown>;
  title: string;
  clientId: string;
  version?: number;
};


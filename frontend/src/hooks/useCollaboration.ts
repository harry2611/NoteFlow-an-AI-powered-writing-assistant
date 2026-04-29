import { useEffect, useMemo, useRef, useState } from 'react';
import { WS_URL } from '../lib/api';
import type { BlockUpdatePayload, Collaborator } from '../types';

type MessageHandler = (payload: BlockUpdatePayload) => void;

export function useCollaboration(documentId: string | null, token: string | null, onRemoteUpdate: MessageHandler) {
  const [users, setUsers] = useState<Collaborator[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);

  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  }, [onRemoteUpdate]);

  useEffect(() => {
    if (!documentId || !token) return;
    const socket = new WebSocket(`${WS_URL}/ws/${documentId}?token=${encodeURIComponent(token)}`);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      setUsers([]);
    };
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.users) setUsers(payload.users);
      if (payload.type === 'block_update' && payload.clientId !== clientId) {
        onRemoteUpdateRef.current(payload);
      }
    };
    return () => {
      socket.close();
    };
  }, [clientId, documentId, token]);

  const sendUpdate = (payload: Omit<BlockUpdatePayload, 'clientId' | 'documentId'>) => {
    if (!documentId || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ ...payload, documentId, clientId }));
  };

  const sendCursor = (blockId?: string, position?: number) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'cursor', blockId, position }));
  };

  return { users, connected, sendUpdate, sendCursor, clientId };
}


import { Wifi, WifiOff } from 'lucide-react';
import type { Collaborator } from '../types';

type Props = {
  users: Collaborator[];
  connected: boolean;
};

export function CollaborationPresence({ users, connected }: Props) {
  return (
    <div className="presence">
      <span className={connected ? 'connection online' : 'connection'}>
        {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
        {connected ? 'Live' : 'Offline'}
      </span>
      <div className="avatar-stack">
        {users.slice(0, 5).map((user) => (
          <span
            className="avatar"
            key={user.connection_id}
            style={{ backgroundColor: user.avatar_color }}
            title={user.name}
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}


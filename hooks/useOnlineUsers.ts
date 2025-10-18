import { useState, useEffect } from 'react';
import { getOnlineUsers, subscribeToOnlineUsers, type OnlineUser } from '../services/OnlineUserService';

export default function useOnlineUsers() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      setLoading(true);
      const initialUsers = await getOnlineUsers();
      setUsers(initialUsers);
      setLoading(false);

      unsubscribe = subscribeToOnlineUsers((updatedUsers) => {
        setUsers(updatedUsers);
      });
    };

    init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { users, loading };
}

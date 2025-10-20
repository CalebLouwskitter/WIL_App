import { useState, useEffect } from 'react';
import { getOnlineUsers, subscribeToOnlineUsers, type OnlineUser } from '../services/OnlineUserService';

export default function useOnlineUsers() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let hasSnapshot = false;

    const dedupe = (list: OnlineUser[]) => {
      const map = new Map<string, OnlineUser>();
      for (const u of list) {
        const key = `${u.uid}_${u.deviceId || 'unknown'}`;
        // keep the most recent by lastSeen
        const prev = map.get(key);
        if (!prev || (u.lastSeen || 0) > (prev.lastSeen || 0)) {
          map.set(key, u);
        }
      }
      return Array.from(map.values());
    };

    const init = async () => {
      console.log('[useOnlineUsers] init');
      setLoading(true);
      try {
        const initialUsers = await getOnlineUsers();
        const deduped = dedupe(initialUsers);
        console.log(`[useOnlineUsers] initial fetch -> users=${initialUsers.length} deduped=${deduped.length}`);
        setUsers(deduped);
      } finally {
        setLoading(false);
      }

      unsubscribe = subscribeToOnlineUsers((updatedUsers) => {
        hasSnapshot = true;
        const deduped = dedupe(updatedUsers);
        console.log(`[useOnlineUsers] onSnapshot -> users=${updatedUsers.length} deduped=${deduped.length}`);
        setUsers(deduped);
      });

      pollTimer = setInterval(async () => {
        if (hasSnapshot) return; // avoid flicker once realtime is active
        try {
          const refreshed = await getOnlineUsers();
          const deduped = dedupe(refreshed);
          console.log(`[useOnlineUsers] poll refresh -> users=${refreshed.length} deduped=${deduped.length}`);
          setUsers(deduped);
        } catch (e) {
          console.warn('[useOnlineUsers] poll refresh error', e);
        }
      }, 30000);
    };

    init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (pollTimer !== undefined) clearInterval(pollTimer);
    };
  }, []);

  return { users, loading };
}

import { useState, useEffect, useRef } from 'react';
import {
  getOnlineUsersWithSource,
  subscribeToOnlineUsers,
  type OnlineUser,
} from '../services/OnlineUserService';
import { filterPresent } from '../utils/presence';

export type OnlineUsersSource = 'live' | 'cached' | 'unavailable';

export type UseOnlineUsersResult = {
  users: OnlineUser[];
  loading: boolean;
  source: OnlineUsersSource;
  lastUpdated: number | null;
};

export default function useOnlineUsers(): UseOnlineUsersResult {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [source, setSource] = useState<OnlineUsersSource>('unavailable');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const latestUsersRef = useRef<OnlineUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let agingTimer: ReturnType<typeof setInterval> | undefined;
    let hasSnapshot = false;

    const init = async () => {
      setLoading(true);
      try {
        const res = await getOnlineUsersWithSource();
        if (cancelled) return;
        latestUsersRef.current = res.users;
        setUsers(res.users);
        setSource(res.source);
        setLastUpdated(Date.now());
      } catch (e) {
        if (cancelled) return;
        console.warn('[useOnlineUsers] init fetch error', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      if (cancelled) return;

      unsubscribe = subscribeToOnlineUsers(
        (updatedUsers) => {
          if (cancelled) return;
          hasSnapshot = true;
          latestUsersRef.current = updatedUsers;
          const present = filterPresent(updatedUsers, Date.now());
          setUsers(present);
          setSource('live');
          setLastUpdated(Date.now());
        },
        (error) => {
          if (cancelled) return;
          console.warn('[useOnlineUsers] listener error; resuming polling', error);
          hasSnapshot = false;
        }
      );

      if (cancelled) {
        if (unsubscribe) unsubscribe();
        return;
      }

      pollTimer = setInterval(async () => {
        if (hasSnapshot) return;
        try {
          const res = await getOnlineUsersWithSource();
          if (cancelled) return;
          latestUsersRef.current = res.users;
          setUsers(res.users);
          setSource(res.source);
          setLastUpdated(Date.now());
        } catch (e) {
          if (cancelled) return;
          console.warn('[useOnlineUsers] poll refresh error', e);
        }
      }, 30000);

      agingTimer = setInterval(() => {
        if (cancelled) return;
        const present = filterPresent(latestUsersRef.current, Date.now());
        setUsers(present);
      }, 60000);

      if (cancelled) {
        if (pollTimer !== undefined) clearInterval(pollTimer);
        if (agingTimer !== undefined) clearInterval(agingTimer);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
      if (agingTimer !== undefined) {
        clearInterval(agingTimer);
        agingTimer = undefined;
      }
    };
  }, []);

  return { users, loading, source, lastUpdated };
}

// client/src/hooks/useFranchiseMembership.js
// Is the logged-in member an APPROVED franchise? Used to give franchise
// holders their partner badge and banners across the member portal.
// The status is fetched once per member and shared by every caller.
import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const cache = new Map(); // userId -> Promise<franchise | null>

const load = (userId) => {
  if (!cache.has(userId)) {
    cache.set(userId, api.get('/api/franchise/status')
      .then((res) => res.data?.data?.franchise || null)
      .catch(() => {
        cache.delete(userId); // retry on the next mount
        return null;
      }));
  }
  return cache.get(userId);
};

/** Call after the franchise status may have changed (e.g. after applying). */
export const refreshFranchiseMembership = (userId) => cache.delete(userId);

const useFranchiseMembership = () => {
  const { user } = useAuth();
  const userId = user?._id;
  const isMember = (user?.role || 'MEMBER').toUpperCase() === 'MEMBER';
  const [franchise, setFranchise] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!userId || !isMember) {
      setFranchise(null);
      return undefined;
    }
    load(userId).then((f) => { if (alive) setFranchise(f); });
    return () => { alive = false; };
  }, [userId, isMember]);

  return {
    franchise,
    isFranchise: franchise?.status === 'APPROVED',
    since: franchise?.decidedAt || null
  };
};

export default useFranchiseMembership;

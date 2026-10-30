'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { currentUser, isConfigured, supabase } from './supabase';

export interface AccountState {
  user: User | null;
  /** True until the first session check finishes. */
  loading: boolean;
  /** Set when the player opened a password-reset link. */
  recovering: boolean;
}

/** Live view of who is signed in on this device. */
export function useAccount(): AccountState & { doneRecovering: () => void } {
  const [state, setState] = useState<AccountState>({ user: null, loading: true, recovering: false });

  useEffect(() => {
    if (!isConfigured) {
      setState({ user: null, loading: false, recovering: false });
      return;
    }
    let alive = true;
    currentUser()
      .then((user) => alive && setState((s) => ({ ...s, user, loading: false })))
      .catch(() => alive && setState((s) => ({ ...s, loading: false })));
    const { data } = supabase().auth.onAuthStateChange((event, session) => {
      const user = session?.user && !session.user.is_anonymous ? session.user : null;
      setState((s) => ({ user, loading: false, recovering: event === 'PASSWORD_RECOVERY' ? true : s.recovering }));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { ...state, doneRecovering: () => setState((s) => ({ ...s, recovering: false })) };
}

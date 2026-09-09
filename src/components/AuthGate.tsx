import type { ReactNode } from 'react';
import { AuthContext } from '../lib/authContext';
import { starterUser } from '../lib/starterPreview';

const workspaceUser = { ...starterUser, id: 'teenclean-workspace', sharedWorkspace: true };
const noPersonalAccount = async () => { throw new Error('This is a shared workspace, not a personal account.'); };

export function AuthGate({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ user: workspaceUser, updateProfile: noPersonalAccount, deleteAccount: noPersonalAccount, signOut: noPersonalAccount }}>{children}</AuthContext.Provider>;
}

import type { AuthUser, IAuthService } from './IAuthService';

const SHOWCASE_USER: AuthUser = {
  id: 'showcase',
  email: 'showcase@windfingerprint.demo',
  name: 'Showcase visitor',
};

/**
 * Auth service for the public GitHub Pages showcase build (VITE_SHOWCASE=true).
 * There is no backend on Pages, so this never touches the network -- every
 * visitor is "signed in" as a fixed demo user immediately.
 */
export class StaticAuthService implements IAuthService {
  readonly fabricAuthEnabled = false;

  async signIn(): Promise<AuthUser> {
    return SHOWCASE_USER;
  }

  async signOut(): Promise<void> {}

  async getCurrentUser(): Promise<AuthUser | null> {
    return SHOWCASE_USER;
  }

  async initEmbeddedAuth(): Promise<AuthUser | null> {
    return SHOWCASE_USER;
  }
}

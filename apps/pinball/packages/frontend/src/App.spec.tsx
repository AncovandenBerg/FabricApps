//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The app shell is rendered on its own here, so both of its data sources are
// stubbed: the leaderboard would otherwise reach for a Rayfin client that this
// environment has no configuration for, and `useAuth` requires the provider
// that only `Root` installs.
vi.mock('@/hooks/use-high-scores', () => ({
  useHighScores: () => ({
    scores: [],
    status: 'ready' as const,
    error: null,
    refresh: vi.fn(),
    submit: vi.fn(),
  }),
}));

vi.mock('@/hooks/auth.context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/hooks/auth.context')>();
  return {
    ...actual,
    useAuth: () => ({
      session: {
        user: { id: 'user-1', email: 'ada.lovelace@example.com' },
        isAuthenticated: true,
        isAnonymous: false,
      },
      isAuthenticated: true,
      isLoading: false,
      canSignIn: true,
      signIn: vi.fn(),
      isSigningIn: false,
      signInError: null,
      config: { kind: 'ready' as const },
      error: null,
    }),
  };
});

import App from '@/App';

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('shows the table and the leaderboard as separate windows', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: '3D Pinball — Orbital Cadet' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'High Scores' })
    ).toBeVisible();
  });

  it('reports an empty leaderboard rather than inventing rows', () => {
    render(<App />);
    expect(screen.getByText(/No scores yet/)).toBeVisible();
  });

  // Two of them on purpose: the menu bar item and the start overlay.
  it('offers a start control before any ball is in play', () => {
    render(<App />);
    expect(
      screen.getAllByRole('button', { name: 'New Game' }).length
    ).toBeGreaterThan(0);
  });

  it('opens the controls window from the Help menu', () => {
    render(<App />);
    expect(screen.queryByRole('heading', { name: /Help/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(
      screen.getByRole('heading', { name: 'Help — Controls' })
    ).toBeVisible();
  });
});

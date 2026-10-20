import type { LocalPartyState } from '../../shared/types.js';

const prefix = 'cgp-party:';

export function loadPartyState(sessionId: string): LocalPartyState | null {
  const value = sessionStorage.getItem(`${prefix}${sessionId}`);
  return value ? (JSON.parse(value) as LocalPartyState) : null;
}

export function savePartyState(state: LocalPartyState): void {
  sessionStorage.setItem(`${prefix}${state.sessionId}`, JSON.stringify(state));
}

export function clearPartyState(sessionId: string): void {
  sessionStorage.removeItem(`${prefix}${sessionId}`);
}

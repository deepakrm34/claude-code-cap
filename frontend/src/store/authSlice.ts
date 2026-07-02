import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import { api, type AuthResponse, type User } from './api';

const STORAGE_KEY = 'auth';

export interface AuthState {
  token: string | null;
  user: User | null;
}

/** Rehydrate the persisted JWT + user from localStorage (defensive parse). */
function loadPersistedAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AuthState>;
      if (
        typeof parsed.token === 'string' &&
        parsed.user &&
        typeof parsed.user.id === 'string' &&
        typeof parsed.user.email === 'string' &&
        typeof parsed.user.name === 'string'
      ) {
        return { token: parsed.token, user: parsed.user };
      }
    }
  } catch {
    // Corrupted storage — fall through to the logged-out state.
  }
  return { token: null, user: null };
}

function persist(state: AuthState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: state.token, user: state.user }));
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadPersistedAuth,
  reducers: {
    setCredentials(state, action: PayloadAction<AuthResponse>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      persist(state);
    },
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
  extraReducers: (builder) => {
    // Successful register or login automatically stores + persists the session.
    builder.addMatcher(
      isAnyOf(api.endpoints.register.matchFulfilled, api.endpoints.login.matchFulfilled),
      (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
        persist(state);
      },
    );
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

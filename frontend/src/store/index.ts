import { configureStore, isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer, { logout } from './authSlice';

/**
 * When any authenticated request comes back 401 (expired/revoked token),
 * drop the stored session so the app returns to the logged-in-out state.
 * The token guard keeps failed *login* attempts (also 401) from looping.
 */
const unauthenticatedMiddleware: Middleware = ({ dispatch, getState }) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const payload = action.payload as { status?: number | string } | undefined;
    const { auth } = getState() as { auth: { token: string | null } };
    if (payload?.status === 401 && auth.token) {
      dispatch(logout());
    }
  }
  return next(action);
};

/**
 * RTK Query's cache is keyed by endpoint+args only — it has no notion of which
 * user fetched the data. Without this, one user's cached tasks survive logout
 * (default keepUnusedDataFor: 60s) and are served to the next user on the same
 * tab. Listening for the logout action covers every call site: the header
 * button, the 401 auto-logout above, and any future one.
 */
const resetApiOnLogout: Middleware = (storeApi) => (next) => (action) => {
  const result = next(action);
  if (logout.match(action)) {
    storeApi.dispatch(api.util.resetApiState());
  }
  return result;
};

/** Factory so tests can create isolated stores; the app uses the singleton below. */
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware, unauthenticatedMiddleware, resetApiOnLogout),
  });
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

/** Extract a human-readable message from an RTK Query error object. */
export function apiErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    if ('data' in err) {
      const data = (err as { data?: unknown }).data;
      if (typeof data === 'object' && data !== null && 'error' in data) {
        const message = (data as { error?: unknown }).error;
        if (typeof message === 'string') return message;
      }
    }
    if ('status' in err && (err as { status?: unknown }).status === 'FETCH_ERROR') {
      return 'Cannot reach the server — is the backend running?';
    }
  }
  return 'Something went wrong. Please try again.';
}

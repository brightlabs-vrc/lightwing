export const MOCK_MODE =
  (process.env.VITE_MOCK_MODE as string | undefined) === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

import { useCallback, useEffect, useRef, useState } from 'react';

const DELAY_MS = 800;

// Collects field changes and sends them in one request once the user pauses.
// Saves run one at a time so an older request can never land after a newer one.
export function useAutosave(save) {
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error
  const [error, setError] = useState('');

  const pending = useRef({});
  const timer = useRef(null);
  const chain = useRef(Promise.resolve());
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(() => {
    clearTimeout(timer.current);

    chain.current = chain.current.then(async () => {
      const changes = pending.current;
      if (Object.keys(changes).length === 0) return;
      pending.current = {};
      setStatus('saving');

      try {
        await saveRef.current(changes);
        setError('');
        setStatus(Object.keys(pending.current).length === 0 ? 'saved' : 'dirty');
      } catch (err) {
        // Put the changes back so "Retry" (or the next edit) sends them again.
        pending.current = { ...changes, ...pending.current };
        setError(err.message);
        setStatus('error');
      }
    });
    return chain.current;
  }, []);

  const queue = useCallback((changes) => {
    Object.assign(pending.current, changes);
    setStatus('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DELAY_MS);
  }, [flush]);

  // Don't lose the last few keystrokes when navigating away inside the app.
  useEffect(() => () => { flush(); }, [flush]);

  useEffect(() => {
    if (status === 'saved') return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  return { status, error, queue, flush };
}

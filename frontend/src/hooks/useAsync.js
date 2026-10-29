import { useCallback, useEffect, useState } from 'react';

/**
 * Hook personnalisé : exécute une fonction asynchrone (un appel API) et expose
 * { data, loading, error, reload, setData }. Il est relancé quand `deps` change.
 *
 * Exemple : const { data, loading, error } = useAsync(() => getEvent(id), [id]);
 *
 * Le drapeau `ignore` évite un bug classique : si `deps` change pendant qu'une requête
 * est en cours, la réponse de l'ancienne requête ne doit pas écraser la nouvelle.
 */
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    // On garde les anciennes données pendant le rechargement (pas de clignotement)
    setState((previous) => ({ ...previous, loading: true, error: null }));
    asyncFn().then(
      (data) => !ignore && setState({ data, loading: false, error: null }),
      (error) => !ignore && setState({ data: null, loading: false, error }),
    );
    return () => {
      ignore = true;
    };
    // asyncFn change à chaque rendu : ce sont les `deps` qui décident de relancer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const setData = useCallback(
    (updater) =>
      setState((previous) => ({
        ...previous,
        data: typeof updater === 'function' ? updater(previous.data) : updater,
      })),
    [],
  );

  return { ...state, reload, setData };
}

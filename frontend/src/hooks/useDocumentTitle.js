import { useEffect } from 'react';

/** Met à jour le titre de l'onglet : "Mes billets · EventPass". */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · EventPass` : 'EventPass — billetterie d’événements';
  }, [title]);
}

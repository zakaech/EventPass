import { useState } from 'react';
import { CATEGORIES, FILTER_KEYS } from '../utils/constants';
import styles from './EventFilters.module.css';

/**
 * Formulaire de filtres « contrôlé » : chaque champ affiche la valeur de l'état React
 * `values` et le met à jour via onChange. Les filtres ne sont appliqués qu'à la
 * soumission (onApply), pour ne pas lancer une requête à chaque frappe.
 */
export function EventFilters({ initialValues, onApply }) {
  const [values, setValues] = useState(initialValues);

  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const reset = () => {
    const empty = Object.fromEntries(FILTER_KEYS.map((key) => [key, '']));
    setValues(empty);
    onApply(empty);
  };

  return (
    <form
      className={styles.filters}
      onSubmit={(event) => {
        event.preventDefault(); // pas de rechargement de la page
        onApply(values);
      }}
    >
      <div className={styles.field}>
        <label className="label" htmlFor="f-ville">
          Ville
        </label>
        <input
          id="f-ville"
          name="ville"
          className="input"
          placeholder="Paris, Lyon…"
          value={values.ville}
          onChange={update}
        />
      </div>

      <div className={styles.field}>
        <label className="label" htmlFor="f-categorie">
          Catégorie
        </label>
        <select
          id="f-categorie"
          name="categorie"
          className="select"
          value={values.categorie}
          onChange={update}
        >
          <option value="">Toutes</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className={styles.group}>
        <legend className="label">Dates</legend>
        <div className={styles.pair}>
          <input
            aria-label="À partir du"
            type="date"
            name="date_min"
            className="input"
            value={values.date_min}
            onChange={update}
          />
          <input
            aria-label="Jusqu’au"
            type="date"
            name="date_max"
            className="input"
            value={values.date_max}
            onChange={update}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className="label">Prix (€)</legend>
        <div className={styles.pair}>
          <input
            aria-label="Prix minimum"
            type="number"
            min="0"
            step="1"
            name="prix_min"
            className="input"
            placeholder="Min"
            value={values.prix_min}
            onChange={update}
          />
          <input
            aria-label="Prix maximum"
            type="number"
            min="0"
            step="1"
            name="prix_max"
            className="input"
            placeholder="Max"
            value={values.prix_max}
            onChange={update}
          />
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className="btn btn-dark btn-block">
          Appliquer
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={reset}>
          Réinitialiser
        </button>
      </div>
    </form>
  );
}

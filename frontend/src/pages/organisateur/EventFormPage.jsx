import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { createEvent, getMyEvent, updateEvent } from '../../services/organisateurService';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/PageHeader';
import { FormField } from '../../components/FormField';
import { EventArt } from '../../components/EventArt';
import { PageLoader } from '../../components/Loader';
import { Alert } from '../../components/Alert';
import { CATEGORIES } from '../../utils/constants';
import { formatDateTime, formatPrice, toDateTimeLocal } from '../../utils/format';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import styles from './organisateur.module.css';

const EMPTY_FORM = {
  titre: '',
  categorie: 'CONCERT',
  description: '',
  ville: '',
  lieu: '',
  date_debut: '',
  capacite: '',
  prix: '',
  image_url: '',
};

/** Création (/organisateur/evenements/nouveau) et édition (/:id/modifier) partagent ce formulaire. */
export function EventFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Modifier l’événement' : 'Nouvel événement');

  // En édition, on charge l'événement avant d'afficher le formulaire
  const {
    data: event,
    loading,
    error,
  } = useAsync(() => (isEdit ? getMyEvent(id) : Promise.resolve(null)), [id]);

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="container page">
        <Alert variant="error">{getErrorMessage(error)}</Alert>
      </div>
    );
  }

  const initial = event
    ? {
        ...EMPTY_FORM,
        ...event,
        description: event.description ?? '',
        image_url: event.image_url ?? '',
        date_debut: toDateTimeLocal(event.date_debut),
        capacite: String(event.capacite),
        prix: String(event.prix),
      }
    : EMPTY_FORM;

  return <EventForm event={event} initial={initial} />;
}

function EventForm({ event, initial }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  // Date de repli pour l'aperçu, figée au premier rendu (un rendu doit rester « pur »)
  const [placeholderDate] = useState(() => new Date());
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(event);
  const vendus = event ? event.capacite - event.places_restantes : 0;
  const locked = isEdit && event.statut !== 'PUBLIE';

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    // Conversion des valeurs du formulaire (toujours des chaînes) vers le format de l'API
    const payload = {
      titre: form.titre,
      categorie: form.categorie,
      ville: form.ville,
      lieu: form.lieu,
      // "2026-11-14T20:00" (heure locale) → ISO 8601 en UTC
      date_debut: form.date_debut ? new Date(form.date_debut).toISOString() : '',
      capacite: Number(form.capacite),
      prix: Number(form.prix),
    };
    if (form.description.trim()) payload.description = form.description;
    if (form.image_url.trim()) payload.image_url = form.image_url.trim();

    try {
      const saved = isEdit ? await updateEvent(event.id, payload) : await createEvent(payload);
      navigate(`/organisateur/evenements/${saved.id}`, {
        state: { flash: isEdit ? 'Modifications enregistrées.' : 'Événement publié !' },
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  };

  // Aperçu en direct de la carte, construit à partir des valeurs saisies
  const preview = {
    titre: form.titre || 'Titre de l’événement',
    categorie: form.categorie,
    date_debut: form.date_debut ? new Date(form.date_debut) : placeholderDate,
    image_url: form.image_url.trim() || null,
  };

  return (
    <div className="container page">
      <Link
        to={isEdit ? `/organisateur/evenements/${event.id}` : '/organisateur'}
        className={styles.back}
      >
        ← Retour
      </Link>
      <PageHeader
        eyebrow={isEdit ? 'Modification' : 'Nouvel événement'}
        title={isEdit ? event.titre : 'Créer un événement'}
      >
        {isEdit
          ? 'Les modifications sont visibles immédiatement par le public.'
          : 'L’événement est publié et réservable dès la validation du formulaire.'}
      </PageHeader>

      {locked && (
        <Alert variant="warning">
          Cet événement est annulé ou terminé : il n’est plus modifiable.
        </Alert>
      )}

      <div className={styles.formLayout}>
        <form className={`card card-pad ${styles.form}`} onSubmit={onSubmit} noValidate>
          {error && <Alert variant="error">{error}</Alert>}

          <fieldset className={styles.fieldset} disabled={locked || submitting}>
            <legend className={styles.legend}>L’événement</legend>
            <FormField label="Titre" error={fieldErrors.titre}>
              {(id, props) => (
                <input
                  id={id}
                  {...props}
                  name="titre"
                  className="input"
                  value={form.titre}
                  onChange={update}
                />
              )}
            </FormField>
            <FormField label="Catégorie" error={fieldErrors.categorie}>
              {(id, props) => (
                <select
                  id={id}
                  {...props}
                  name="categorie"
                  className="select"
                  value={form.categorie}
                  onChange={update}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Description" error={fieldErrors.description} hint="Facultatif">
              {(id, props) => (
                <textarea
                  id={id}
                  {...props}
                  name="description"
                  className="textarea"
                  value={form.description}
                  onChange={update}
                />
              )}
            </FormField>
            <FormField
              label="Image (URL)"
              error={fieldErrors.image_url}
              hint="Facultatif — sinon un visuel aux couleurs de la catégorie est utilisé"
            >
              {(id, props) => (
                <input
                  id={id}
                  {...props}
                  name="image_url"
                  type="url"
                  placeholder="https://…"
                  className="input"
                  value={form.image_url}
                  onChange={update}
                />
              )}
            </FormField>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={locked || submitting}>
            <legend className={styles.legend}>Où et quand</legend>
            <div className={styles.grid2}>
              <FormField label="Ville" error={fieldErrors.ville}>
                {(id, props) => (
                  <input
                    id={id}
                    {...props}
                    name="ville"
                    className="input"
                    value={form.ville}
                    onChange={update}
                  />
                )}
              </FormField>
              <FormField label="Lieu" error={fieldErrors.lieu}>
                {(id, props) => (
                  <input
                    id={id}
                    {...props}
                    name="lieu"
                    className="input"
                    value={form.lieu}
                    onChange={update}
                  />
                )}
              </FormField>
            </div>
            <FormField label="Date et heure" error={fieldErrors.date_debut}>
              {(id, props) => (
                <input
                  id={id}
                  {...props}
                  name="date_debut"
                  type="datetime-local"
                  className="input"
                  value={form.date_debut}
                  onChange={update}
                />
              )}
            </FormField>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={locked || submitting}>
            <legend className={styles.legend}>Billetterie</legend>
            <div className={styles.grid2}>
              <FormField
                label="Capacité"
                error={fieldErrors.capacite}
                hint={isEdit && vendus > 0 ? `Minimum ${vendus} (billets déjà vendus)` : undefined}
              >
                {(id, props) => (
                  <input
                    id={id}
                    {...props}
                    name="capacite"
                    type="number"
                    min={Math.max(1, vendus)}
                    className="input"
                    value={form.capacite}
                    onChange={update}
                  />
                )}
              </FormField>
              <FormField
                label="Prix (€)"
                error={fieldErrors.prix}
                hint="0 pour un événement gratuit"
              >
                {(id, props) => (
                  <input
                    id={id}
                    {...props}
                    name="prix"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={form.prix}
                    onChange={update}
                  />
                )}
              </FormField>
            </div>
          </fieldset>

          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary" disabled={locked || submitting}>
              {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Publier l’événement'}
            </button>
          </div>
        </form>

        <aside className={styles.preview}>
          <span className={styles.legend}>Aperçu</span>
          <div className={styles.previewCard}>
            <EventArt event={preview} />
            <div className={styles.previewBody}>
              <strong>{preview.titre}</strong>
              <span className="muted">
                {[form.lieu, form.ville].filter(Boolean).join(' · ') || 'Lieu · Ville'}
              </span>
              <span className="muted">
                {form.date_debut ? formatDateTime(form.date_debut) : 'Date à définir'}
              </span>
              <span className={styles.previewPrice}>
                {form.prix !== '' ? formatPrice(Number(form.prix)) : '— €'}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

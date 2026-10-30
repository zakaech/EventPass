import { useState } from 'react';
import { getGlobalStats, listOrganisateurs, setValidation } from '../../services/adminService';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Loader } from '../../components/Loader';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { getCategory } from '../../utils/constants';
import { formatNumber, formatPrice, formatShortDate } from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';
import styles from './admin.module.css';

const TABS = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'VALIDE', label: 'Validés' },
  { value: 'REFUSE', label: 'Refusés' },
  { value: '', label: 'Tous' },
];

export function AdminPage() {
  useDocumentTitle('Administration');
  const { user } = useAuth();
  const stats = useAsync(() => getGlobalStats(), []);
  // Compte de démonstration : consultation uniquement (règle appliquée par le serveur,
  // l'interface ne fait que l'expliquer et désactiver les boutons)
  const lectureSeule = Boolean(user?.lecture_seule);

  return (
    <div className="container page">
      <PageHeader eyebrow="Administration" title="Vue d’ensemble">
        Activité de la plateforme et validation des comptes organisateurs.
      </PageHeader>

      <div className="stack">
        {lectureSeule && (
          <Alert variant="info" title="Compte de démonstration en lecture seule">
            Vous pouvez consulter les statistiques et les comptes en attente, mais pas valider ni
            refuser un organisateur : ces actions sont réservées à un vrai compte administrateur.
          </Alert>
        )}
        {stats.error && <Alert variant="error">{getErrorMessage(stats.error)}</Alert>}
        {stats.loading && !stats.data && <Loader />}
        {stats.data && <GlobalStats stats={stats.data} />}
        <OrganisateursSection onChange={stats.reload} lectureSeule={lectureSeule} />
      </div>
    </div>
  );
}

function GlobalStats({ stats }) {
  return (
    <>
      <div className={styles.stats}>
        <StatCard label="Billets vendus" value={formatNumber(stats.billets_vendus)} accent />
        <StatCard label="Chiffre d’affaires" value={formatPrice(stats.chiffre_affaires)} />
        <StatCard
          label="Événements"
          value={formatNumber(stats.evenements)}
          hint={`${formatNumber(stats.evenements_a_venir)} à venir`}
        />
        <StatCard label="Spectateurs" value={formatNumber(stats.utilisateurs)} />
        <StatCard
          label="Organisateurs"
          value={formatNumber(stats.organisateurs_valides)}
          hint={`${formatNumber(stats.organisateurs_en_attente)} en attente`}
        />
      </div>

      <div className={styles.tops}>
        <TopList
          title="Top catégories"
          items={stats.top_categories.map((c) => ({
            key: c.categorie,
            label: getCategory(c.categorie).label,
            color: getCategory(c.categorie).color,
            value: c.billets_vendus,
          }))}
        />
        <TopList
          title="Top villes"
          items={stats.top_villes.map((v) => ({
            key: v.ville,
            label: v.ville,
            color: 'var(--ink)',
            value: v.billets_vendus,
          }))}
        />
      </div>
    </>
  );
}

/** Classement sous forme de barres horizontales proportionnelles au premier élément. */
function TopList({ title, items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="card card-pad">
      <h2 className={styles.topTitle}>{title}</h2>
      {items.length === 0 ? (
        <p className="muted">Pas encore de ventes.</p>
      ) : (
        <ol className={styles.topList}>
          {items.map((item) => (
            <li key={item.key} className={styles.topItem}>
              <span className={styles.topLabel}>{item.label}</span>
              <span className={styles.topBar}>
                <span style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
              </span>
              <span className={styles.topValue}>{formatNumber(item.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function OrganisateursSection({ onChange, lectureSeule }) {
  const [tab, setTab] = useState('EN_ATTENTE');
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const list = useAsync(() => listOrganisateurs({ statut: tab, page, limit: 10 }), [tab, page]);

  const decide = async (organisateur, statut) => {
    setPendingId(organisateur.id);
    setFeedback(null);
    try {
      await setValidation(organisateur.id, statut);
      setFeedback({
        type: 'success',
        message: `${organisateur.nom_organisation} : compte ${statut === 'VALIDE' ? 'validé' : 'refusé'}.`,
      });
      list.reload();
      onChange();
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className={`card ${styles.orgs}`}>
      <div className={styles.orgsHead}>
        <h2>Comptes organisateurs</h2>
        <div className={styles.tabs} role="tablist" aria-label="Filtrer par statut">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`${styles.tab} ${tab === t.value ? styles.tabActive : ''}`}
              onClick={() => {
                setTab(t.value);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.orgsBody}>
        {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}
        {list.error && <Alert variant="error">{getErrorMessage(list.error)}</Alert>}
        {list.loading && !list.data && <Loader />}

        {list.data?.data.length === 0 && (
          <EmptyState title="Rien à traiter">
            {tab === 'EN_ATTENTE'
              ? 'Aucune demande en attente de validation.'
              : 'Aucun organisateur dans cette catégorie.'}
          </EmptyState>
        )}

        {list.data?.data.length > 0 && (
          <ul className={styles.orgList}>
            {list.data.data.map((orga) => (
              <li key={orga.id} className={styles.org}>
                <div className={styles.orgMain}>
                  <div className="row">
                    <strong className={styles.orgName}>{orga.nom_organisation}</strong>
                    <StatusBadge statut={orga.statut_validation} />
                  </div>
                  <p className="muted">
                    {orga.nom} · {orga.email} · {orga.ville} · inscrit le{' '}
                    {formatShortDate(orga.created_at)}
                  </p>
                  {orga.description && <p className={styles.orgDesc}>{orga.description}</p>}
                </div>
                <div className={styles.orgActions}>
                  {orga.statut_validation !== 'VALIDE' && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      disabled={lectureSeule || pendingId === orga.id}
                      title={lectureSeule ? 'Indisponible : compte en lecture seule' : undefined}
                      onClick={() => decide(orga, 'VALIDE')}
                    >
                      Valider
                    </button>
                  )}
                  {orga.statut_validation !== 'REFUSE' && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={lectureSeule || pendingId === orga.id}
                      title={lectureSeule ? 'Indisponible : compte en lecture seule' : undefined}
                      onClick={() => decide(orga, 'REFUSE')}
                    >
                      {orga.statut_validation === 'VALIDE' ? 'Suspendre' : 'Refuser'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination pagination={list.data?.pagination} onPageChange={setPage} />
      </div>
    </section>
  );
}

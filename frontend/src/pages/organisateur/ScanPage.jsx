import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { checkIn, listMyEvents } from '../../services/organisateurService';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/PageHeader';
import { PageLoader } from '../../components/Loader';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { formatDateTime, formatTime } from '../../utils/format';
import { getErrorCode, getErrorMessage } from '../../utils/errors';
import { shortCode } from '../../utils/events';
import { signalScan } from '../../utils/feedback';
import styles from './scan.module.css';

const READER_ID = 'lecteur-qr';

/** Page /organisateur/scanner?event=ID : choix de l'événement contrôlé, puis scanner. */
export function ScanPage() {
  useDocumentTitle('Contrôle des billets');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error } = useAsync(() => listMyEvents({ limit: 50 }), []);

  if (loading && !data) return <PageLoader />;
  if (error) {
    return (
      <div className="container page">
        <Alert variant="error">{getErrorMessage(error)}</Alert>
      </div>
    );
  }

  // Événements dont le contrôle est ouvert (non annulés, jusqu'à N heures après le début)
  const ouverts = data.data
    .filter((e) => e.checkin_ouvert)
    .sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut));
  const demande = Number(searchParams.get('event'));
  const event = ouverts.find((e) => e.id === demande) ?? ouverts[0];

  if (!event) {
    return (
      <div className="container page">
        <PageHeader eyebrow="Contrôle à l’entrée" title="Scanner les billets" />
        <EmptyState
          title="Aucun événement à contrôler"
          action={
            <Link to="/organisateur" className="btn btn-dark">
              Mes événements
            </Link>
          }
        >
          Le contrôle des billets est ouvert pour vos événements non annulés, jusqu’à quelques
          heures après leur début.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Contrôle à l’entrée"
        title={event.titre}
        actions={
          ouverts.length > 1 && (
            <label className={styles.eventPicker}>
              <span className="visually-hidden">Événement contrôlé</span>
              <select
                className="select"
                value={event.id}
                onChange={(e) => setSearchParams({ event: e.target.value })}
              >
                {ouverts.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titre} — {formatDateTime(e.date_debut)}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      >
        {formatDateTime(event.date_debut)} · {event.lieu}, {event.ville}
      </PageHeader>

      {/* key : changer d'événement recrée le scanner (caméra arrêtée, historique vidé) */}
      <Scanner key={event.id} event={event} />
    </div>
  );
}

// Présentation de chaque résultat possible renvoyé par l'API
const RESULTS = {
  VALIDE: { tone: 'ok', icon: 'check', title: 'Entrée validée' },
  DEJA_UTILISE: { tone: 'warn', icon: 'alert', title: 'Déjà utilisé' },
  BILLET_ANNULE: { tone: 'bad', icon: 'cross', title: 'Billet annulé' },
  AUTRE_EVENEMENT: { tone: 'other', icon: 'swap', title: 'Autre événement' },
  QR_INVALIDE: { tone: 'bad', icon: 'cross', title: 'QR code invalide' },
  EVENEMENT_ANNULE: { tone: 'bad', icon: 'cross', title: 'Événement annulé' },
  CHECKIN_FERME: { tone: 'neutral', icon: 'cross', title: 'Contrôle fermé' },
};
const presentation = (code) =>
  RESULTS[code] ?? { tone: 'neutral', icon: 'cross', title: 'Vérification impossible' };

function describe(result) {
  const { code, billet, details, message } = result;
  switch (code) {
    case 'VALIDE':
      return [billet.nom, `Billet ${shortCode(billet.code)}`];
    case 'DEJA_UTILISE':
      return [
        `Premier scan à ${formatTime(details.checked_in_at)}`,
        details.nom ? `Billet de ${details.nom}` : null,
      ];
    case 'BILLET_ANNULE':
      return ['Ce billet a été annulé et ne donne pas accès.', details?.nom];
    case 'AUTRE_EVENEMENT':
      return [
        details?.evenement
          ? `Billet valable pour « ${details.evenement} »`
          : 'Ce billet n’est pas valable pour cet événement.',
      ];
    case 'QR_INVALIDE':
      return ['Billet falsifié, modifié ou illisible.', 'Refusez l’entrée.'];
    default:
      return [message];
  }
}

function Scanner({ event }) {
  const scannerRef = useRef(null); // instance Html5Qrcode (objet hors React)
  const busyRef = useRef(false); // un seul billet traité à la fois
  const [camera, setCamera] = useState('off'); // off | starting | on | error
  const [cameraError, setCameraError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [manual, setManual] = useState('');
  const [checking, setChecking] = useState(false);

  const verify = useCallback(
    async (token, source) => {
      setChecking(true);
      let outcome;
      try {
        const data = await checkIn(event.id, token);
        outcome = { ok: true, code: 'VALIDE', billet: data.billet };
      } catch (err) {
        outcome = {
          ok: false,
          code: getErrorCode(err) ?? 'ERREUR',
          message: getErrorMessage(err),
          details: err.response?.data?.error?.details,
        };
      }
      outcome = { ...outcome, source, at: new Date(), id: Date.now() };
      signalScan(outcome.ok);
      setResult(outcome);
      setHistory((previous) => [outcome, ...previous].slice(0, 8));
      setChecking(false);
      return outcome;
    },
    [event.id],
  );

  // La bibliothèque appelle ce callback à chaque image où elle lit un QR code (≈10/s) :
  // on met la caméra en pause dès la première lecture pour ne traiter le billet qu'une fois.
  const onDecoded = useCallback(
    (text) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        scannerRef.current?.pause(true);
      } catch {
        /* déjà en pause */
      }
      verify(text, 'caméra');
    },
    [verify],
  );
  // Le callback est donné une seule fois à scanner.start() : une ref permet de toujours
  // appeler sa version la plus récente.
  const onDecodedRef = useRef(onDecoded);
  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  const startCamera = async () => {
    setCameraError(null);
    // getUserMedia n'existe que dans un « contexte sécurisé » : HTTPS ou localhost
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setCamera('error');
      setCameraError('insecure');
      return;
    }
    setCamera('starting');
    try {
      const scanner = new Html5Qrcode(READER_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' }, // caméra arrière sur téléphone
        {
          fps: 10,
          qrbox: (width, height) => {
            const side = Math.floor(Math.min(width, height) * 0.7);
            return { width: side, height: side };
          },
        },
        (text) => onDecodedRef.current(text),
        () => {}, // appelé à chaque image sans QR lisible : rien à faire
      );
      setCamera('on');
    } catch (err) {
      scannerRef.current = null;
      setCamera('error');
      const denied = err?.name === 'NotAllowedError' || /permission|denied/i.test(String(err));
      setCameraError(denied ? 'denied' : 'unavailable');
    }
  };

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCamera('off');
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* déjà arrêtée */
      }
    }
  };

  // Nettoyage : libérer la caméra quand on quitte la page (sinon le voyant reste allumé)
  useEffect(
    () => () => {
      const scanner = scannerRef.current;
      if (scanner)
        scanner.stop().then(
          () => scanner.clear(),
          () => {},
        );
    },
    [],
  );

  const next = () => {
    setResult(null);
    busyRef.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      /* caméra non démarrée ou pas en pause */
    }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (!manual.trim() || checking) return;
    busyRef.current = true;
    try {
      scannerRef.current?.pause(true);
    } catch {
      /* caméra non démarrée */
    }
    const outcome = await verify(manual, 'saisie');
    if (outcome.ok) setManual('');
  };

  const valides = history.filter((h) => h.ok).length;

  return (
    <div className={styles.layout}>
      <section className={styles.viewport} aria-label="Caméra">
        <div id={READER_ID} className={styles.reader} />
        <span className={styles.corners} aria-hidden="true" />

        {camera !== 'on' && !result && (
          <div className={styles.cameraOverlay}>
            {camera === 'error' ? (
              <CameraError reason={cameraError} onRetry={startCamera} />
            ) : (
              <>
                <svg viewBox="0 0 24 24" className={styles.cameraIcon} aria-hidden="true">
                  <path
                    d="M4 8h3l2-3h6l2 3h3v11H4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle
                    cx="12"
                    cy="13"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
                <p>Scannez les QR codes des billets avec la caméra de cet appareil.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startCamera}
                  disabled={camera === 'starting'}
                >
                  {camera === 'starting' ? 'Démarrage…' : 'Activer la caméra'}
                </button>
              </>
            )}
          </div>
        )}

        {result && <ResultOverlay result={result} onNext={next} />}
      </section>

      <aside className={styles.side}>
        <form className={`card card-pad ${styles.manual}`} onSubmit={submitManual}>
          <label className="label" htmlFor="code-manuel">
            Saisie manuelle
          </label>
          <p className={styles.manualHint}>
            Caméra indisponible ou QR illisible : tapez le code de secours imprimé sous le QR.
          </p>
          <div className={styles.manualRow}>
            <input
              id="code-manuel"
              className={`input ${styles.manualInput}`}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button type="submit" className="btn btn-dark" disabled={checking || !manual.trim()}>
              Vérifier
            </button>
          </div>
        </form>

        <section className="card card-pad">
          <div className={styles.sessionHead}>
            <h2>Cette session</h2>
            <span className={styles.sessionCount}>
              <strong>{valides}</strong> entrée{valides > 1 ? 's' : ''} validée
              {valides > 1 ? 's' : ''}
            </span>
          </div>
          {history.length === 0 ? (
            <p className="muted">Les billets contrôlés apparaîtront ici.</p>
          ) : (
            <ol className={styles.history}>
              {history.map((h) => {
                const p = presentation(h.code);
                return (
                  <li key={h.id} className={styles.historyItem}>
                    <span className={`${styles.dot} ${styles[`tone-${p.tone}`]}`} />
                    <span className={styles.historyTitle}>{p.title}</span>
                    <span className={styles.historyMeta}>
                      {h.billet?.nom ?? h.details?.nom ?? ''}
                    </span>
                    <time className={styles.historyTime}>{formatTime(h.at)}</time>
                  </li>
                );
              })}
            </ol>
          )}
          <div className={styles.sessionFoot}>
            <Link to={`/organisateur/evenements/${event.id}`} className="btn btn-ghost btn-sm">
              Statistiques de l’événement →
            </Link>
            {camera === 'on' && (
              <button type="button" className="btn btn-outline btn-sm" onClick={stopCamera}>
                Couper la caméra
              </button>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ResultOverlay({ result, onNext }) {
  const p = presentation(result.code);
  const lines = describe(result).filter(Boolean);
  return (
    <div className={`${styles.result} ${styles[`tone-${p.tone}`]}`} role="alert">
      <ResultIcon name={p.icon} />
      <p className={styles.resultTitle}>{p.title}</p>
      {lines.map((line) => (
        <p key={line} className={styles.resultLine}>
          {line}
        </p>
      ))}
      <button type="button" className={`btn ${styles.nextButton}`} onClick={onNext} autoFocus>
        Scanner le suivant
      </button>
    </div>
  );
}

function ResultIcon({ name }) {
  const paths = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    cross: 'M7 7l10 10M17 7L7 17',
    alert: 'M12 7v6M12 16.5v.5',
    swap: 'M5 9h12l-3-3M19 15H7l3 3',
  };
  return (
    <svg viewBox="0 0 24 24" className={styles.resultIcon} aria-hidden="true">
      <path
        d={paths[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraError({ reason, onRetry }) {
  const messages = {
    insecure:
      'La caméra n’est accessible qu’en HTTPS (ou sur localhost). Utilisez la saisie manuelle, ou ouvrez le site en HTTPS.',
    denied:
      'L’accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou utilisez la saisie manuelle.',
    unavailable:
      'Aucune caméra utilisable n’a été trouvée sur cet appareil. Utilisez la saisie manuelle.',
  };
  return (
    <>
      <p className={styles.cameraErrorTitle}>Caméra indisponible</p>
      <p>{messages[reason] ?? messages.unavailable}</p>
      {reason !== 'insecure' && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </>
  );
}

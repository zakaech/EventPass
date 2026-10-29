// Fragments SQL partagés pour lire un événement.
//
// Statut calculé à la lecture : en base, un événement reste 'PUBLIE' même une fois sa date
// passée (aucune tâche planifiée ne le met à jour). Le CASE renvoie 'TERMINE' dès que
// date_debut est atteinte, pour que l'API donne toujours le bon statut sans jamais
// dépendre d'un traitement périodique. 'ANNULE' reste 'ANNULE'.
//
// Ces fragments sont des constantes écrites par nous, jamais des données utilisateur :
// les insérer dans le texte SQL ne pose aucun risque d'injection.

function statutSql(alias) {
  return `CASE WHEN ${alias}.statut = 'PUBLIE' AND ${alias}.date_debut <= now()
               THEN 'TERMINE'::statut_event ELSE ${alias}.statut END`;
}

/** Colonnes d'un événement, avec le statut calculé à la place du statut stocké. */
function eventColumns(alias) {
  return [
    'id',
    'organisateur_id',
    'titre',
    'description',
    'categorie',
    'ville',
    'lieu',
    'date_debut',
    'capacite',
    'places_restantes',
    'prix',
    'image_url',
    'created_at',
  ]
    .map((column) => `${alias}.${column}`)
    .concat(`${statutSql(alias)} AS statut`)
    .join(', ');
}

module.exports = { statutSql, eventColumns };

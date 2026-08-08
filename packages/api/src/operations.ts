/**
 * Catalogue déclaratif des opérations de l'API.
 *
 * ⚠️ **Source unique de vérité.** Ce catalogue alimente à la fois
 * `/api/_discover` — donc ce qu'un agent découvre — et le **test de parité**
 * qui échoue dès qu'une opération n'a pas de commande CLI correspondante
 * (docs/22 §4.5).
 *
 * Sans lui, la promesse « tout ce qu'un humain peut faire, un agent doit
 * pouvoir le faire » serait une intention. Avec lui, c'est une assertion.
 */

export interface ApiOperation {
  /** Identifiant stable, repris tel quel comme nom de commande CLI. */
  readonly id: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly purpose: string;
  /** `true` si l'opération accepte `?dryRun=true`. */
  readonly supportsDryRun?: boolean;
  /** `true` si l'opération accepte un en-tête `Idempotency-Key`. */
  readonly supportsIdempotency?: boolean;
}

export const API_OPERATIONS: readonly ApiOperation[] = [
  {
    id: 'discover',
    method: 'GET',
    path: '/api/_discover',
    purpose: "Découvrir l'application, ses conventions et son état courant",
  },
  { id: 'health', method: 'GET', path: '/api/health', purpose: 'Vérifier que le serveur répond' },

  {
    id: 'process:list',
    method: 'GET',
    path: '/api/process-templates',
    purpose: 'Lister les modèles de process',
  },
  {
    id: 'process:create',
    method: 'POST',
    path: '/api/process-templates',
    purpose: 'Créer un modèle et sa première version (brouillon)',
    supportsDryRun: true,
  },
  {
    id: 'process:versions',
    method: 'GET',
    path: '/api/process-templates/:id/versions',
    purpose: "Lister les versions d'un modèle",
  },
  {
    id: 'version:get',
    method: 'GET',
    path: '/api/process-versions/:id',
    purpose: 'Lire une version de process',
  },
  {
    id: 'version:publish',
    method: 'POST',
    path: '/api/process-versions/:id/publish',
    purpose: 'Publier une version — elle devient immuable, aucune unité ne bouge',
    supportsDryRun: true,
  },
  {
    id: 'version:draft',
    method: 'POST',
    path: '/api/process-versions/:id/draft',
    purpose: "Ouvrir un brouillon à partir d'une version",
  },
  {
    id: 'version:graph',
    method: 'POST',
    path: '/api/process-versions/:id/graph',
    purpose: "Remplacer le graphe d'un brouillon",
  },

  {
    id: 'unit:create',
    method: 'POST',
    path: '/api/units',
    purpose: 'Créer une unité de culture à un stade quelconque',
    supportsDryRun: true,
    supportsIdempotency: true,
  },
  { id: 'unit:list', method: 'GET', path: '/api/units', purpose: 'Lister les unités par stade' },
  {
    id: 'unit:get',
    method: 'GET',
    path: '/api/units/:reference',
    purpose: "Lire la fiche d'une unité",
  },
  {
    id: 'unit:timeline',
    method: 'GET',
    path: '/api/units/:reference/timeline',
    purpose: "Lire le journal d'événements d'une unité",
  },
  {
    id: 'unit:next-steps',
    method: 'GET',
    path: '/api/units/:reference/next-steps',
    purpose: 'Lire les étapes nominales atteignables',
  },
  {
    id: 'unit:advance',
    method: 'POST',
    path: '/api/units/:reference/advance',
    purpose: "Faire avancer une unité — toute étape est atteignable, l'écart demande confirmation",
    supportsDryRun: true,
    supportsIdempotency: true,
  },
  {
    id: 'unit:observe',
    method: 'POST',
    path: '/api/units/:reference/observations',
    purpose: 'Enregistrer une observation — photo obligatoire sur contamination',
    supportsDryRun: true,
  },
  {
    id: 'unit:observation-kinds',
    method: 'GET',
    path: '/api/units/:reference/observation-kinds',
    purpose: 'Lister les observations pertinentes au stade courant',
  },
  {
    id: 'unit:measure',
    method: 'POST',
    path: '/api/units/:reference/measurements',
    purpose: 'Enregistrer une mesure',
    supportsDryRun: true,
  },
  {
    id: 'unit:audit',
    method: 'GET',
    path: '/api/units/:reference/audit',
    purpose: "Vérifier que le journal et l'état stocké concordent",
  },
  {
    id: 'unit:trace',
    method: 'GET',
    path: '/api/units/:reference/trace',
    purpose: 'Descendre aux produits issus de cette unité',
  },

  {
    id: 'qr:assign',
    method: 'POST',
    path: '/api/units/:reference/qr',
    purpose: 'Attribuer un QR à une unité — idempotent, le token ne change jamais',
    supportsDryRun: true,
  },
  {
    id: 'qr:resolve',
    method: 'GET',
    path: '/api/qr/:token',
    purpose: 'Résoudre un token scanné vers sa cible',
  },
  {
    id: 'label:print',
    method: 'POST',
    path: '/api/units/:reference/label/print',
    purpose: "Imprimer l'étiquette — une réimpression réutilise le même token",
    supportsDryRun: true,
  },
  {
    id: 'printer:test',
    method: 'GET',
    path: '/api/printer/test',
    purpose: "Vérifier que l'imprimante répond",
  },

  {
    id: 'harvest:record',
    method: 'POST',
    path: '/api/units/:reference/harvests',
    purpose: 'Enregistrer une récolte — poids par flush, qualité, pertes avec cause',
    supportsDryRun: true,
  },
  {
    id: 'harvest:list',
    method: 'GET',
    path: '/api/units/:reference/harvests',
    purpose: "Lister les récoltes d'une unité et son rendement",
  },
  {
    id: 'product:create',
    method: 'POST',
    path: '/api/products',
    purpose: 'Créer un produit final — mélanges autorisés à proportions exactes',
    supportsDryRun: true,
  },
  {
    id: 'product:trace',
    method: 'GET',
    path: '/api/products/:reference/trace',
    purpose: "Remonter d'un produit aux unités qui l'ont produit",
  },
];

/** Recettes des tâches courantes, servies à la découverte. */
export const API_RECIPES: Readonly<Record<string, string>> = {
  'faire avancer une unité':
    '1) unit:get pour lire sa version. 2) unit:next-steps. 3) unit:advance --dry-run pour vérifier. 4) même commande sans --dry-run.',
  'créer un process':
    '1) process:create avec le graphe en JSON. 2) version:publish. Le graphe est le même JSON que celui édité par le canvas.',
  'du spore à l’assiette':
    '1) unit:create. 2) qr:assign. 3) label:print. 4) unit:advance jusqu’à un flush. 5) harvest:record. 6) product:create. 7) product:trace pour remonter.',
  'vérifier la traçabilité': 'unit:audit rend les divergences entre journal et état stocké.',
};

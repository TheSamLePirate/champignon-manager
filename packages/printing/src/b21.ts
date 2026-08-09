import type { LabelContent } from '@champi/domain';
import type { PrintTransport } from './transport.js';

/**
 * Transport Nimbot B21 Pro.
 *
 * L'imprimante a été validée par le cultivateur (`docs/21` §7) et un pilote BLE
 * fonctionnel existe (`../nimbot-lib`). Ce module ne refait pas ce pilote : il
 * traduit une `LabelContent` en travail d'impression et **injecte** l'accès BLE.
 *
 * Le découpage suit celui du reste du dépôt :
 *
 * - la **composition de l'étiquette** est pure, donc entièrement testée ;
 * - l'**accès BLE** est un port (`B21Driver`), branché à l'assemblage. C'est le
 *   seul endroit qui touche la radio, comme l'horloge et l'aléa ne vivent que
 *   dans `packages/api/src/server.ts`.
 *
 * Ce découpage n'est pas de la coquetterie : le BLE est la partie la plus
 * fragile du système — appairage, permissions, déconnexions — et c'est la seule
 * qu'on ne peut pas éprouver sans matériel sous la main.
 */

/** Géométrie de l'étiquette. 50×30 mm à 300 ppp, largeur multiple de 8. */
export const B21_GEOMETRY = {
  widthPx: 584,
  heightPx: 354,
  /** Densité 3 sur 5 : lisible sans brûler le ruban (défaut du pilote). */
  density: 3,
} as const;

/**
 * Travail d'impression, tel que le pilote l'attend.
 *
 * `data` est le **token opaque**, jamais une URL ni une donnée métier : le QR
 * ne doit rien révéler s'il est photographié hors de la ferme (`docs/10`).
 */
export interface B21Job {
  readonly data: string;
  readonly title: string;
  readonly caption: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly density: number;
  readonly copies: number;
}

/** Accès à l'imprimante. Implémenté à l'assemblage, faux dans les tests. */
export interface B21Driver {
  /** L'imprimante répond-elle, ici et maintenant ? */
  probe(): Promise<boolean>;
  printQr(job: B21Job): Promise<void>;
}

/**
 * Compose le travail d'impression à partir du contenu d'étiquette.
 *
 * Le cultivateur a demandé quatre choses sur l'étiquette (`q17_4`) : **nom
 * d'unité, type, date, code QR**. Le titre porte le nom ; la légende porte le
 * type, la date et le code public, qui est ce qu'on lit à voix haute quand le
 * QR est illisible.
 */
export function composeB21Job(label: LabelContent, copies: number): B21Job {
  return {
    data: label.qrToken,
    title: label.name,
    caption: `${label.type} · ${label.date} · ${label.publicCode}`,
    widthPx: B21_GEOMETRY.widthPx,
    heightPx: B21_GEOMETRY.heightPx,
    density: B21_GEOMETRY.density,
    copies,
  };
}

/**
 * Transport branché sur une B21 Pro.
 *
 * Il ne réessaie pas : la file d'impression s'en charge déjà, avec son propre
 * décompte de tentatives. Deux couches de retry produiraient neuf essais là où
 * l'on en a demandé trois — et autant d'étiquettes sorties en double.
 */
export class B21Transport implements PrintTransport {
  readonly name = 'nimbot-b21';

  constructor(private readonly driver: B21Driver) {}

  probe(): Promise<boolean> {
    return this.driver.probe();
  }

  async send(label: LabelContent, copies: number): Promise<void> {
    // Le pilote lève en cas d'échec ; on n'avale rien, la file doit voir
    // l'erreur pour marquer le travail « failed » plutôt que « printed ».
    await this.driver.printQr(composeB21Job(label, copies));
  }
}

import { appError } from '@champi/contracts';
import { err, ok, type LabelContent, type Result } from '@champi/domain';
import type { PrintTransport } from './transport.js';

/**
 * File d'impression avec reprise.
 *
 * Le Wi-Fi de chambre est mauvais et le BLE se déconnecte : un échec
 * d'impression est **normal**, pas exceptionnel. La file réessaie, et surtout
 * elle **conserve la trace** de chaque tentative — c'est ce qui permet de dire
 * « cette étiquette n'est jamais sortie » plutôt que de le deviner.
 *
 * Ce module ne connaît ni l'imprimante ni la base : le transport et l'horloge
 * sont injectés.
 */

export type PrintJobStatus = 'pending' | 'printed' | 'failed';

export interface PrintJob {
  readonly id: string;
  readonly unitId: string;
  readonly label: LabelContent;
  readonly copies: number;
  readonly status: PrintJobStatus;
  readonly attempts: number;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
  /** `true` quand ce travail réimprime une étiquette déjà émise. */
  readonly isReprint: boolean;
}

export interface PrintRequest {
  readonly id: string;
  readonly unitId: string;
  readonly label: LabelContent;
  readonly copies?: number;
  readonly isReprint?: boolean;
  readonly nowIso: string;
}

/** Nombre de tentatives avant d'abandonner et de le dire clairement. */
export const MAX_ATTEMPTS = 3;

function validateCopies(copies: number): Result<number> {
  if (!Number.isInteger(copies) || copies < 1) {
    return err(
      appError('VALIDATION_FAILED', `Nombre de copies invalide : ${String(copies)}.`, {
        hint: 'Le nombre de copies est un entier supérieur ou égal à 1.',
        path: 'copies',
      }),
    );
  }
  if (copies > 50) {
    return err(
      appError(
        'VALIDATION_FAILED',
        `${String(copies)} copies demandées : c'est probablement une erreur de saisie.`,
        {
          hint: 'Le maximum est de 50 copies par travail. Découpe en plusieurs travaux si c’est volontaire.',
          path: 'copies',
        },
      ),
    );
  }
  return ok(copies);
}

export class PrintQueue {
  constructor(private readonly transport: PrintTransport) {}

  /** L'imprimante répond-elle ? Alimente le bouton « test imprimante ». */
  async testPrinter(): Promise<Result<{ transport: string; reachable: boolean }>> {
    const reachable = await this.transport.probe();
    if (!reachable) {
      return err(
        appError('CONFLICT', `L'imprimante « ${this.transport.name} » ne répond pas.`, {
          hint: 'Vérifie qu’elle est allumée, appairée et à portée. Les étiquettes en attente seront imprimées à la reconnexion.',
        }),
      );
    }
    return ok({ transport: this.transport.name, reachable });
  }

  /**
   * Exécute un travail d'impression, avec reprises.
   *
   * Rend **toujours** un `PrintJob` : un échec est un état du travail, pas une
   * exception. Une étiquette non imprimée doit rester visible dans la file, pas
   * disparaître dans une erreur remontée à l'appelant.
   */
  async run(request: PrintRequest): Promise<Result<PrintJob>> {
    const copies = validateCopies(request.copies ?? 1);
    if (!copies.ok) {
      return copies;
    }

    const base = {
      id: request.id,
      unitId: request.unitId,
      label: request.label,
      copies: copies.value,
      createdAt: request.nowIso,
      isReprint: request.isReprint ?? false,
    };

    // `lastMessage` est une *initialisation*, pas un repli conditionnel : la
    // boucle tourne toujours au moins une fois, donc soit elle rend un succès,
    // soit elle a affecté le message. Une variante à `lastError?: AppError`
    // obligeait à un `?? 'Échec inconnu.'` jamais atteint — du code mort, que
    // la règle « pas d'exclusion de couverture » interdit de masquer.
    let lastMessage = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.transport.send(request.label, copies.value);
        return ok({
          ...base,
          status: 'printed',
          attempts: attempt,
          completedAt: request.nowIso,
        });
      } catch (cause) {
        lastMessage = cause instanceof Error ? cause.message : "Échec d'impression inconnu.";
      }
    }

    return ok({
      ...base,
      status: 'failed',
      attempts: MAX_ATTEMPTS,
      lastError: lastMessage,
    });
  }
}

import type { LabelContent } from '@champi/domain';

/**
 * Transport d'impression.
 *
 * L'imprimante **Nimbot B21 a été testée et fonctionne** (docs/21 §7), mais son
 * pilote est du BLE rétro-conçu : c'est la partie la plus fragile du système
 * (appairage, déconnexions, permissions). Elle est donc isolée derrière cette
 * interface, pour trois raisons :
 *
 * 1. **Testabilité** : un faux transport permet de tester toute la logique
 *    d'impression — file, retries, statuts — sans imprimante branchée ;
 * 2. **Repli** : un transport « fichier » produit une étiquette exploitable si
 *    le BLE lâche en pleine session ;
 * 3. **Isolement runtime** : si Bun s'avère incompatible avec la pile BLE
 *    (risque P2-10, déjà confirmé une fois sur Stryker), le transport peut
 *    partir dans un process Node sans toucher au reste.
 */

export interface PrintTransport {
  readonly name: string;
  /** Une imprimante joignable ? Sert au bouton « test imprimante ». */
  probe(): Promise<boolean>;
  /** Envoie une étiquette. Doit lever en cas d'échec, jamais échouer en silence. */
  send(label: LabelContent, copies: number): Promise<void>;
}

/**
 * Transport de test et de repli : mémorise les étiquettes au lieu de les
 * imprimer. Utilisé par les tests, et exploitable comme trace si le BLE tombe.
 */
export class InMemoryTransport implements PrintTransport {
  readonly name = 'memoire';
  readonly printed: { label: LabelContent; copies: number }[] = [];

  private failuresRemaining = 0;
  private reachable = true;

  /** Programme les `count` prochains envois pour qu'ils échouent. */
  failNext(count: number): void {
    this.failuresRemaining = count;
  }

  setReachable(reachable: boolean): void {
    this.reachable = reachable;
  }

  probe(): Promise<boolean> {
    return Promise.resolve(this.reachable);
  }

  send(label: LabelContent, copies: number): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      return Promise.reject(new Error('Imprimante injoignable (transport de test).'));
    }
    this.printed.push({ label, copies });
    return Promise.resolve();
  }
}

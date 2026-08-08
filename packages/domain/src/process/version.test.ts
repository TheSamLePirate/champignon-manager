import { describe, expect, it } from 'vitest';
import type { ProcessVersion } from '@champi/contracts';
import {
  draftFromVersion,
  editVersionGraph,
  planMigration,
  publishVersion,
  publishingAffectsRunningUnits,
} from './version.js';
import { makeDefaultGraph, makeStep } from '../__testing__/builders.js';

const PUBLISHED_AT = '2026-08-08T10:00:00.000Z';

function makeVersion(overrides: Partial<ProcessVersion> = {}): ProcessVersion {
  return {
    id: 'pv-1',
    templateId: 'pt-1',
    versionNumber: 1,
    status: 'draft',
    graph: makeDefaultGraph(),
    ...overrides,
  };
}

describe('editVersionGraph', () => {
  it('modifie le graphe d’un brouillon', () => {
    const next = { steps: [makeStep({ id: 'unique' })], transitions: [] };
    const result = editVersionGraph(makeVersion(), next);
    expect(result.ok && result.value.graph).toEqual(next);
  });

  it('refuse de modifier une version publiée et explique la comparaison', () => {
    const result = editVersionGraph(makeVersion({ status: 'published' }), makeDefaultGraph());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VERSION_PUBLISHED_IMMUTABLE');
    expect(result.error.message).toContain('publiée');
    expect(result.error.hint).toContain('épinglées');
    expect(result.error.hint).toContain('comparer');
    expect(result.error.path).toBe('versionId');
  });

  it('ne modifie pas la version d’origine', () => {
    const version = makeVersion();
    editVersionGraph(version, { steps: [], transitions: [] });
    expect(version.graph.steps.length).toBeGreaterThan(0);
  });
});

describe('publishVersion', () => {
  it('publie un brouillon valide et l’horodate', () => {
    const result = publishVersion(makeVersion(), PUBLISHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('published');
    expect(result.value.publishedAt).toBe(PUBLISHED_AT);
  });

  it('refuse de republier une version déjà publiée', () => {
    const result = publishVersion(makeVersion({ status: 'published' }), PUBLISHED_AT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VERSION_PUBLISHED_IMMUTABLE');
    expect(result.error.message).toContain('déjà publiée');
  });

  it('refuse de publier un graphe invalide', () => {
    const result = publishVersion(
      makeVersion({ graph: { steps: [], transitions: [] } }),
      PUBLISHED_AT,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROCESS_GRAPH_INVALID');
    expect(result.error.message).toContain('aucune étape');
  });

  it('cite le numéro de version dans le message', () => {
    const result = publishVersion(
      makeVersion({ versionNumber: 7, status: 'published' }),
      PUBLISHED_AT,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('7');
  });

  it('ne modifie pas la version d’origine', () => {
    const version = makeVersion();
    publishVersion(version, PUBLISHED_AT);
    expect(version.status).toBe('draft');
    expect(version.publishedAt).toBeUndefined();
  });
});

describe('draftFromVersion', () => {
  it('crée un brouillon au numéro suivant', () => {
    const draft = draftFromVersion(
      makeVersion({ status: 'published', publishedAt: PUBLISHED_AT }),
      'pv-2',
    );
    expect(draft.id).toBe('pv-2');
    expect(draft.versionNumber).toBe(2);
    expect(draft.status).toBe('draft');
  });

  it('efface la date de publication héritée', () => {
    const draft = draftFromVersion(
      makeVersion({ status: 'published', publishedAt: PUBLISHED_AT }),
      'pv-2',
    );
    expect(draft.publishedAt).toBeUndefined();
  });

  it('conserve le graphe de la version source', () => {
    const source = makeVersion();
    expect(draftFromVersion(source, 'pv-2').graph).toEqual(source.graph);
  });
});

describe('publishingAffectsRunningUnits', () => {
  it('ne bascule jamais les unités en cours — la comparaison l’emporte', () => {
    expect(publishingAffectsRunningUnits()).toBe(false);
  });
});

describe('planMigration', () => {
  const target = makeVersion({ id: 'pv-2', versionNumber: 2, status: 'published' });

  it('prépare une migration sur une sélection explicite', () => {
    const result = planMigration(['u-1', 'u-2'], target);
    expect(result).toEqual({
      ok: true,
      value: { unitIds: ['u-1', 'u-2'], targetVersionId: 'pv-2' },
    });
  });

  it('déduplique la sélection', () => {
    const result = planMigration(['u-1', 'u-1', 'u-2'], target);
    expect(result.ok && result.value.unitIds).toEqual(['u-1', 'u-2']);
  });

  it('refuse une migration sans sélection — il n’existe pas de bascule globale', () => {
    const result = planMigration([], target);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain('bascule globale');
    expect(result.error.path).toBe('unitIds');
  });

  it('refuse de migrer vers un brouillon', () => {
    const result = planMigration(['u-1'], makeVersion({ status: 'draft' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain('Publie la version cible');
  });
});

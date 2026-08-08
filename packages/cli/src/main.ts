/* eslint-disable no-console -- point d'entrée d'un CLI : la console est la sortie. */
import { runCli } from './run.js';

/**
 * Point d'entrée du CLI.
 *
 * C'est **la** surface d'agent de l'application (pas de serveur MCP) : la
 * sortie standard porte du JSON, la sortie d'erreur porte du JSON, et le code
 * de sortie vaut 0 ou 1. Un agent peut s'y fier sans analyser du texte libre.
 */
const result = await runCli(process.argv.slice(2), {
  baseUrl: process.env['CHAMPI_URL'] ?? 'http://localhost:3000',
  fetch: globalThis.fetch,
  newIdempotencyKey: () => crypto.randomUUID(),
});

if (result.stdout !== '') {
  console.log(result.stdout);
}
if (result.stderr !== '') {
  console.error(result.stderr);
}
process.exit(result.exitCode);

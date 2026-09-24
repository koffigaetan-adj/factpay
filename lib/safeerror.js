// Message d'erreur technique (envoi d'e-mail échoué…) : jamais montré tel quel à l'écran, pour ne
// pas exposer de détail interne (chemin de fichier, configuration du serveur). Le détail complet
// part toujours dans les journaux du serveur ; seule une phrase courte et sûre, quand elle existe,
// est montrée à la personne connectée.
export function safeError(err, fallback = "Vérifie ta connexion et réessaie dans un instant.") {
  console.error(err);
  const msg = String(err?.message || err || '').split('\n')[0].trim();
  const technical = !msg || msg.length > 160
    || /[\\/](home|users|var|node_modules|users)\b|ENOENT|ECONNREFUSED|ECONNRESET|at \S+\(|Cannot find|undefined is not|TypeError|ReferenceError/i.test(msg);
  return technical ? fallback : msg;
}

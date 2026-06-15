import { Link } from 'react-router-dom'

export default function Guide() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/" className="text-sm text-white/40 hover:text-white">
        ← Config
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold">Guide du streamer</h1>

      <Section title="1. Mise en place (de zéro à en live)">
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>Sur la page Config, entre le nom de ta chaîne Twitch.</li>
          <li>Crée une playlist, colle des URL YouTube ou Spotify — titre/artiste se pré-remplissent.</li>
          <li>Renseigne l'artiste pour activer le <b>double-shot</b>, les <b>featurings</b> et les <b>pièges malus</b>.</li>
          <li>Clique « Lancer le panneau de contrôle ».</li>
          <li>Ouvre l'overlay (bouton « Ouvrir l'overlay ») et ajoute-le dans OBS (voir §3).</li>
          <li>« Démarrer » lance la manche : le chat devine, les scores montent en direct.</li>
        </ol>
      </Section>

      <Section title="2. Comment marquent les points">
        <ul className="space-y-1 pl-5 text-white/80">
          <li>🎯 <b>Bonne réponse</b> : le 1er qui trouve marque le max ; ceux qui suivent dans la fenêtre marquent un peu moins (dégressif).</li>
          <li>🎤 <b>Featuring</b> : +1 par feat trouvé, indépendant de la réponse principale.</li>
          <li>🎯 <b>Double-shot</b> : titre <i>et</i> artiste dans le même message = bonus x2. Un seul des deux = 0 (tout ou rien).</li>
          <li>🔥 <b>Streak</b> : trouver des manches consécutives augmente ton multiplicateur. Un malus le casse.</li>
          <li>💀 <b>Malus</b> : taper un terme piège configuré par le streamer fait perdre des points.</li>
        </ul>
      </Section>

      <Section title="3. Ajouter l'overlay dans OBS">
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>Dans OBS : Sources → + → <b>Source navigateur</b>.</li>
          <li>URL : l'adresse <code className="rounded bg-white/10 px-1">/overlay</code> de cette app (ex : <code className="rounded bg-white/10 px-1">http://localhost:5173/overlay</code>).</li>
          <li>Largeur 1920, hauteur 1080. Le fond est transparent.</li>
          <li>Garde le panneau de contrôle ouvert dans le <b>même navigateur, sur le même PC</b> : la synchro se fait sans serveur (BroadcastChannel).</li>
          <li>Le son de la musique vient de l'onglet contrôle — capture-le via l'audio bureau d'OBS.</li>
        </ol>
      </Section>

      <Section title="4. Connexions Spotify / Twitch (optionnel)">
        <p className="mb-2 text-white/60">
          Tout marche sans, mais connecter les comptes simplifie. Aucun serveur, aucun secret.
        </p>
        <p className="mb-2 rounded bg-amber-500/10 px-2 py-1 text-amber-300">
          ⚠️ En dev, lance l'app sur <b>https://127.0.0.1:5173</b> (HTTPS + IP loopback). Spotify
          refuse le hostname <code className="mx-1 rounded bg-white/10 px-1">localhost</code> (exige
          l'IP <code className="mx-1 rounded bg-white/10 px-1">127.0.0.1</code>) ; Twitch exige du HTTPS.
          Seul <code className="mx-1 rounded bg-white/10 px-1">https://127.0.0.1</code> contente les deux.
          Accepte l'avertissement de certificat auto-signé.
        </p>
        <p className="mb-1 font-medium">Spotify (importer tes playlists)</p>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-white/80">
          <li>Crée une app sur <code className="rounded bg-white/10 px-1">developer.spotify.com/dashboard</code>.</li>
          <li>Redirect URI : <code className="rounded bg-white/10 px-1">https://127.0.0.1:5173/auth/spotify</code> (= l'adresse affichée dans Réglages).</li>
          <li>User Management : ajoute le nom + email Spotify de chaque streamer (≤25 en dev mode). Les viewers n'ont rien à faire.</li>
          <li>Copie le Client ID → colle-le dans Réglages.</li>
        </ol>
        <p className="mb-1 font-medium">Twitch (auto-remplir ta chaîne)</p>
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>Crée une app sur <code className="rounded bg-white/10 px-1">dev.twitch.tv/console/apps</code>.</li>
          <li>OAuth Redirect URL : <code className="rounded bg-white/10 px-1">https://127.0.0.1:5173/auth/twitch</code> (chemin <b>/auth/twitch</b>, pas /auth/spotify !).</li>
          <li>Type de client : <b>Publique</b> (flow JS, aucun secret).</li>
          <li>Copie le Client ID → colle-le dans Réglages.</li>
        </ol>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-xl bg-white/5 p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

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
          <li>Renseigne l'artiste pour activer le <b>combo</b>, les <b>featurings</b> et les <b>pièges malus</b>.</li>
          <li>Clique « Lancer le panneau de contrôle ».</li>
          <li>Ouvre l'overlay (bouton « Ouvrir l'overlay ») et ajoute-le dans OBS (voir §3).</li>
          <li>« Démarrer » lance la manche : le chat devine, les scores montent en direct.</li>
        </ol>
      </Section>

      <Section title="2. Comment marquent les points">
        <ul className="space-y-1 pl-5 text-white/80">
          <li>🎵 <b>Titre</b> : le 1er qui le trouve marque le max ; dans la fenêtre de 5s les suivants marquent un peu moins (dégressif 3 → 1).</li>
          <li>🎸 <b>Artiste</b> : même barème, <b>cible séparée</b> avec sa propre fenêtre. Titre <i>ou</i> artiste rapportent indépendamment.</li>
          <li>🎯 <b>Combo</b> : titre <b>et</b> artiste dans le <b>même message</b> = (titre + artiste) <b>×1.5</b> (récompense car plus long à taper).</li>
          <li>🎤 <b>Featuring</b> : +1 par feat trouvé, indépendant ; révélé sur l'overlay dès qu'il tombe.</li>
          <li>🔥 <b>Streak</b> : trouver des manches consécutives augmente ton multiplicateur (s'empile sur le combo). Un malus le casse.</li>
          <li>💀 <b>Malus</b> : taper un terme piège configuré par le streamer fait perdre des points (−1, −2, −3…).</li>
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
        <p className="mt-3 mb-1 font-medium">🎧 Éviter les strikes DMCA sur la VOD</p>
        <p className="mb-2 text-white/70">
          Aucun mode ne « strip » automatiquement la musique : c'est <b>ton routage OBS</b> qui rend
          la VOD safe. Le mieux : mets la musique sur une <b>piste audio séparée exclue de la VOD</b>.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>
            Choisis le mode <b>App Spotify</b> (Connexions → réglages → Lecture). Le son sort alors de
            l'app desktop, <b>appli séparée</b> facile à isoler (Premium requis). YouTube se capture
            pareil via sa propre source.
          </li>
          <li>
            Dans OBS : capture la musique via une source dédiée (Application Audio Capture / l'app
            Spotify), <b>pas</b> mélangée au reste.
          </li>
          <li>
            Mixer audio avancé → Propriétés audio → décoche la <b>piste VOD/enregistrement</b> pour
            cette source (garde-la sur la piste live). Les viewers entendent, la VOD non.
          </li>
        </ol>
      </Section>

      <Section title="4. Importer une playlist Spotify (ton app, à toi)">
        <p className="mb-2 text-white/60">
          Lire le chat Twitch ne demande <b>rien</b> (lecture anonyme). Seul l'import Spotify
          nécessite une petite config <b>une seule fois</b>, avec <b>ta propre</b> app Spotify
          (gratuite, illimitée pour ton compte). Aucun serveur, aucun secret.
        </p>
        <p className="mb-2 rounded bg-indigo-500/10 px-2 py-1 text-indigo-300">
          📋 Le <b>Redirect URI exact</b> à coller dans le dashboard est affiché dans le panneau{' '}
          <b>Connexions → réglages</b>, avec un bouton « copier ». Il s'adapte tout seul :{' '}
          <code className="mx-1 rounded bg-white/10 px-1">https://127.0.0.1:5173/…</code> en dev,
          ton URL <code className="mx-1 rounded bg-white/10 px-1">…github.io/…</code> en prod.
          Copie-le de là plutôt que de le retaper.
        </p>
        <p className="mb-1 font-medium">Spotify — étapes</p>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-white/80">
          <li>Va sur <code className="rounded bg-white/10 px-1">developer.spotify.com/dashboard</code> → <b>Create app</b>.</li>
          <li>
            Dans <b>Redirect URIs</b> : colle l'adresse Spotify affichée dans Réglages (bouton
            copier). API : coche <b>Web API</b>.
          </li>
          <li>
            Mode dev = <b>User Management</b> : ajoute le nom + email Spotify des comptes autorisés
            (≤25). Ta propre app, ta whitelist.
          </li>
          <li>Copie le <b>Client ID</b> → colle-le dans Réglages → « Connecter Spotify ».</li>
        </ol>
        <p className="mb-2 rounded bg-amber-500/10 px-2 py-1 text-amber-300">
          ⚠️ En <b>dev</b> uniquement, lance l'app sur <b>https://127.0.0.1:5173</b> (Spotify refuse{' '}
          <code className="mx-1 rounded bg-white/10 px-1">localhost</code>, exige l'IP loopback en
          HTTPS). Accepte le certificat auto-signé. En <b>prod</b> (github.io) c'est déjà du HTTPS,
          rien à faire.
        </p>
        <p className="mb-1 font-medium">Twitch login (optionnel — auto-remplit ta chaîne)</p>
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>Le chat se lit <b>sans ça</b> : tape juste ton nom de chaîne. Ceci n'est qu'un confort.</li>
          <li>Si tu veux : app sur <code className="rounded bg-white/10 px-1">dev.twitch.tv/console/apps</code>.</li>
          <li>OAuth Redirect URL : l'adresse <b>Twitch</b> affichée dans Réglages (chemin <b>/auth/twitch</b>).</li>
          <li>Type de client : <b>Publique</b>. Copie le Client ID → Réglages.</li>
        </ol>
      </Section>

      <Footer />
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

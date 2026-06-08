import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Store, MapPin, Info } from 'lucide-react';
import { Card } from '../components/ui';
import { findMagasin, findDistributeur } from '../data';

// Les fichiers reçus des distributeurs sont CONSOLIDÉS au niveau enseigne :
// aucune vente n'est transmise au niveau du point de vente. Cette page ne
// fabrique donc AUCUN chiffre par magasin — elle l'indique honnêtement.

export function MagasinDetail() {
  const { distId = '', code = '' } = useParams();
  const magasin = findMagasin(code);
  const distributeur = findDistributeur(distId);

  if (!magasin || !distributeur) {
    return (
      <div className="max-w-[1320px] mx-auto py-12 text-center">
        <Store size={32} className="text-ink-muted mx-auto mb-3" />
        <p className="text-sm text-ink-muted">Magasin introuvable</p>
        <Link
          to={distId ? `/distributeurs/${distId}` : '/distributeurs'}
          className="text-xs text-silverlit-red hover:underline mt-2 inline-block"
        >
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-1 text-xs text-ink-muted">
          <Link to="/distributeurs" className="hover:text-ink dark:hover:text-night-ink">Distributeurs</Link>
          <span>/</span>
          <Link to={`/distributeurs/${distId}`} className="hover:text-ink dark:hover:text-night-ink">{distributeur.nom}</Link>
          <span>/</span>
          <span className="text-ink dark:text-night-ink">{magasin.code}</span>
        </div>
        <Link
          to={`/distributeurs/${distId}`}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink mt-2"
        >
          <ArrowLeft size={12} />
          Retour à {distributeur.nom}
        </Link>

        <div className="mt-3 flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${distributeur.logoColor}14` }}
          >
            <Store size={20} style={{ color: distributeur.logoColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
              {magasin.libelle}
            </h1>
            <p className="text-sm text-ink-muted dark:text-night-muted mt-1 flex items-center gap-2 flex-wrap">
              <span className="tabular">{magasin.code}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {magasin.ville} · {magasin.region}
              </span>
              <span>·</span>
              <span style={{ color: distributeur.logoColor }}>{distributeur.nom}</span>
            </p>
          </div>
        </div>
      </div>

      <Card>
        <div className="flex items-start gap-3 py-4">
          <div className="w-9 h-9 rounded-xl bg-surface-alt dark:bg-night-alt flex items-center justify-center shrink-0">
            <Info size={16} className="text-ink-muted" />
          </div>
          <div>
            <p className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Détail par point de vente non disponible
            </p>
            <p className="text-sm text-ink-muted dark:text-night-muted mt-1 max-w-[640px] leading-relaxed">
              {distributeur.nom} transmet ses ventes <strong>consolidées au niveau enseigne</strong>,
              sans détail par magasin. Les chiffres fiables (CA, volumes, références) sont donc
              disponibles à l'échelle de l'enseigne, sur sa fiche distributeur — pas par point de vente.
            </p>
            <Link
              to={`/distributeurs/${distId}`}
              className="inline-flex items-center gap-1.5 mt-4 h-9 px-3 rounded-lg bg-ink dark:bg-night-ink text-white dark:text-black text-xs font-medium hover:opacity-90"
            >
              Voir les ventes {distributeur.nom}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

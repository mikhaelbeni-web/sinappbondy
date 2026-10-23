// Gabarit des pages publiques (don, espace fidèle, événement, mikvé) :
// bandeau bleu nuit arrondi avec titre, sous-titre et trait doré, contenu
// en cartes blanches qui chevauchent le bandeau.
export default function PublicPage({
  title,
  subtitle,
  aside,
  width = "max-w-lg",
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream pb-10">
      <header className="bg-gradient-to-br from-ink-dark via-ink to-ink-light text-white rounded-b-[2rem] px-6 pt-10 pb-14">
        <div className={`${width} mx-auto flex items-start justify-between gap-4`}>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
            {subtitle && <div className="text-sm text-white/80 mt-1.5">{subtitle}</div>}
            <span className="block w-14 h-1 rounded-full bg-gold-sand mt-4" />
          </div>
          {aside}
        </div>
      </header>
      <main className={`${width} mx-auto px-4 -mt-8 space-y-5`}>{children}</main>
    </div>
  );
}

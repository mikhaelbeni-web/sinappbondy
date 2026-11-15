// Page de retour après paiement HelloAsso (ou lien de paiement inutilisable).
export default function MerciPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  let title = "Toda raba !";
  let text = "Votre don a bien été enregistré. Merci infiniment pour votre générosité envers la synagogue.";

  if (searchParams.places === "attente") {
    title = "Paiement en cours de vérification";
    text = "Votre paiement n'est pas encore confirmé par HelloAsso. Vos places restent gardées ; vous recevrez un e-mail dès qu'elles seront réservées.";
  } else if (searchParams.places) {
    title = "Vos places sont réservées";
    text = "Votre paiement a bien été reçu. Un e-mail de confirmation avec vos places vous a été envoyé.";
  } else if (searchParams.desinscrit) {
    title = "Désinscription enregistrée";
    text = "Vous ne recevrez plus les messages groupés de la synagogue. Les rappels de dons et reçus fiscaux restent envoyés.";
  } else if (searchParams.deja) {
    title = "Rien à régler";
    text = "Ce montant a déjà été réglé. Merci pour votre générosité.";
  } else if (searchParams.annule) {
    title = "Paiement interrompu";
    text = "Le paiement n'a pas été effectué. Vous pouvez réessayer à tout moment avec le même lien.";
  } else if (searchParams.erreur === "refus") {
    title = "Paiement refusé";
    text = "Le paiement n'a pas abouti. Vous pouvez réessayer avec le même lien ou contacter la synagogue.";
  } else if (searchParams.erreur === "lien") {
    title = "Lien invalide";
    text = "Ce lien de paiement n'est pas valide. Merci de contacter la synagogue.";
  } else if (searchParams.erreur) {
    title = "Paiement indisponible";
    text = "Le paiement en ligne est momentanément indisponible. Merci de réessayer plus tard.";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center card p-8">
        <h1 className="text-2xl font-serif font-bold text-ink mb-2">{title}</h1>
        <p className="text-gray-600">{text}</p>
      </div>
    </div>
  );
}

import DonateForm from "@/components/DonateForm";
import PublicPage from "@/components/PublicPage";

// Page de don publique (sans campagne), accessible sans compte.
export default function DonPage() {
  const name = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  return (
    <PublicPage title="Faire un don" subtitle={`Soutenez ${name}.`}>
        <div className="card p-6">
          <DonateForm />
        </div>
        <p className="text-center text-sm text-gray-500">
          Vous êtes fidèle ? <a href="/espace" className="text-gold hover:underline">Accédez à votre espace</a>
        </p>
    </PublicPage>
  );
}

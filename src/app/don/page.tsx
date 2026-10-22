import DonateForm from "@/components/DonateForm";

// Page de don publique (sans campagne), accessible sans compte.
export default function DonPage() {
  const name = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-serif font-bold text-ink">Faire un don</h1>
          <p className="text-gray-600 mt-1">Soutenez {name}.</p>
        </div>
        <div className="card p-6">
          <DonateForm />
        </div>
        <p className="text-center text-sm text-gray-500">
          Vous êtes fidèle ? <a href="/espace" className="text-gold hover:underline">Accédez à votre espace</a>
        </p>
      </div>
    </div>
  );
}

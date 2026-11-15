import { redirect } from "next/navigation";

// Ancienne adresse : le choix des places se fait sur la page publique.
export default function EspacePlacesRedirect() {
  redirect("/places");
}

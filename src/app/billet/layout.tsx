// Pages publiques des fidèles : mêmes couleurs que le portail.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="theme-portail">{children}</div>;
}

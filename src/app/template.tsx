/** Re-mounts on every navigation so each page enters with the shared route transition. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route">{children}</div>;
}

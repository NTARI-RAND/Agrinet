export default function Footer() {
  return (
    <footer style={{ background: 'var(--soil2)', padding: 'var(--space-md) var(--page-pad)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--cream)' }}>Agrinet</div>
      <div className="flex gap-16">
        <a href="https://github.com/NTARI-RAND/Agrinet" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', textDecoration: 'none' }}>GitHub</a>
        <a href="https://docs.theagri.net" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', textDecoration: 'none' }}>AGPL-3</a>
        <a href="https://www.linkedin.com/in/carloszambonii/" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', textDecoration: 'none' }}>LinkedIn</a>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>© 2025 Agrinet — AGPL-3.0</div>
    </footer>
  );
}

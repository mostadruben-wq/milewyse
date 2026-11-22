/** Mechanisch anmutender Kilometerzähler mit sanft einrollenden Ziffern. */
export function Odometer({ value, digits = 6 }: { value: number | null; digits?: number }) {
  const str = value === null ? '–'.repeat(digits) : String(Math.max(0, Math.round(value))).padStart(digits, '0');
  const chars = str.split('');
  return (
    <span style={{ display: 'inline-flex', gap: 3 }} role="img" aria-label={value === null ? 'Kein Kilometerstand' : `${value.toLocaleString('de-DE')} Kilometer`}>
      {chars.map((c, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && (chars.length - i) % 3 === 0 && <span className="odo-sep" />}
          <span className="odo-digit" style={{ opacity: value !== null && i < chars.length - String(Math.round(value)).length ? 0.45 : 1 }}>
            <span key={c + value} style={{ animationDelay: `${i * 40}ms` }}>
              {c}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

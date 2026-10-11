/**
 * Words rise into place one after another on first paint. Pure CSS (see
 * `.rise-word` in globals.css), so it starts before hydration and needs no
 * client JavaScript. Each word is clipped vertically only, so italic
 * overhangs and descenders aren't cut.
 */
export function RiseText({ text, delay = 0, step = 0.05, className }: { text: string; delay?: number; step?: number; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i}>
          <span className="-my-[0.12em] inline-block overflow-x-visible overflow-y-clip py-[0.12em] align-top">
            <span className="rise-word" style={{ animationDelay: `${(delay + i * step).toFixed(3)}s` }}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

import { Logo, LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PLATFORMS } from "@/lib/social/platforms";

export default function Page() {
  return (
    <main className="p-10">
      <Logo /><div className="mt-4 flex gap-4"><LogoMark variant="tile" className="size-40" /><LogoMark className="size-40" /><LogoMark variant="tile" className="size-8" /><LogoMark variant="tile" className="size-4" /><Logo className="scale-150 origin-left" /></div>
      <div className="mt-6 flex gap-3">{PLATFORMS.map((p) => <PlatformIcon key={p} platform={p} tile />)}</div>
      <div className="mt-6 flex gap-3">{PLATFORMS.map((p) => <PlatformIcon key={p} platform={p} />)}</div>
      <h1 className="mt-8 font-display text-7xl">Neither should <em>your social.</em></h1>
    </main>
  );
}

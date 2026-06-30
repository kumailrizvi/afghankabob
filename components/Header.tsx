import Link from "next/link";

export function Header() {
  return (
    <>
      <div className="w-full bg-kabob-green text-white text-center text-[12px] md:text-sm font-black tracking-[0.18em] py-2.5 uppercase">
        Free rewards signup • Meal passes • Birthday & anniversary offers
      </div>
      <header className="border-b border-[#e7dacb] bg-[#fffdf8]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 py-5 grid grid-cols-[auto_1fr_auto] items-center gap-6">
          <Link href="/meal-pass" className="flex items-center gap-3 min-w-max">
            <div className="logo-mark">AK</div>
            <div className="hidden sm:block">
              <div className="display-font text-2xl font-black text-kabob-green leading-none">Afghan Kabob</div>
              <div className="text-xs font-black tracking-[0.18em] uppercase text-[#74675d] mt-1">Rewards</div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center justify-center gap-1">
            <Link className="header-nav-link" href="/meal-pass">Meal Pass</Link>
            <Link className="header-nav-link" href="/rewards">Rewards</Link>
            <Link className="header-nav-link" href="/login">Login</Link>
            <Link className="header-nav-link" href="/team-login">Staff / Owner Login</Link>
          </nav>

          <Link className="btn-primary min-w-max" href="/rewards">Join Rewards</Link>
        </div>
      </header>
    </>
  );
}

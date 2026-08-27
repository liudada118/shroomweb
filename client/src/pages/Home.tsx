import { lazy, Suspense, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSensorSection from "@/components/hero/HeroSensorSection";
import ShroomPortalHome from "@/components/sections/ShroomPortalHome";

const ShroomJourneySection = lazy(
  () => import("@/components/sections/ShroomJourneySection")
);

type EntryMode = "portal" | "juqiao" | "shroom";

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed left-6 top-20 z-[60] rounded-full px-4 py-2 text-xs tracking-[0.22em] uppercase transition-all duration-300 md:left-8"
      style={{
        color: "rgba(255,255,255,0.74)",
        background: "rgba(4,8,22,0.72)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(16px)",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      Back To Entry
    </button>
  );
}

export default function Home() {
  const [entryMode, setEntryMode] = useState<EntryMode>("portal");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [entryMode]);

  if (entryMode === "portal") {
    return <ShroomPortalHome onOpenJuqiao={() => setEntryMode("juqiao")} />;
  }

  if (entryMode === "juqiao") {
    return (
      <div className="min-h-screen" style={{ background: "#0a0e1a" }}>
        <Navbar />
        <BackButton onClick={() => setEntryMode("portal")} />
        <HeroSensorSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#040816" }}>
      <Suspense fallback={null}>
        <ShroomJourneySection onBack={() => setEntryMode("portal")} />
      </Suspense>
    </div>
  );
}

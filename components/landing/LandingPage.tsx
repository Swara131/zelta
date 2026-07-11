import LandingNavbar from "./LandingNavbar";
import AnimatedBackground from "./AnimatedBackground";
import Hero from "./Hero";
import LogoCloud from "./LogoCloud";
import ProblemSection from "./ProblemSection";
import HowItWorks from "./HowItWorks";
import FeaturesSection from "./FeaturesSection";
import ArchitectureSection from "./ArchitectureSection";
import DeveloperCodeSection from "./DeveloperCodeSection";
import LandingPricing from "./LandingPricing";
import FAQSection from "./FAQSection";
import CTASection from "./CTASection";
import LandingFooter from "./LandingFooter";

export default function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen bg-[#06060a] text-zinc-100">
      <AnimatedBackground />
      <LandingNavbar />
      <main id="main-content">
        <Hero />
        <LogoCloud />
        <ProblemSection />
        <HowItWorks />
        <FeaturesSection />
        <ArchitectureSection />
        <DeveloperCodeSection />
        <LandingPricing />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}

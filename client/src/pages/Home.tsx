import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ProblemSection } from "@/components/ProblemSection";
import { ProductSection } from "@/components/ProductSection";
import { SolutionsSection } from "@/components/SolutionsSection";
import { ProcessSection } from "@/components/ProcessSection";
import { ROISection } from "@/components/ROISection";
import { AssessmentSection } from "@/components/AssessmentSection";
import { Footer } from "@/components/Footer";
import { PrototypeSection } from "@/components/prototype/PrototypeSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <ProductSection />
        <SolutionsSection />
        <ProcessSection />
        <PrototypeSection />
        <ROISection />
        <AssessmentSection />
      </main>
      <Footer />
    </div>
  );
}

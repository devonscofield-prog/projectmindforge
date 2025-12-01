import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Maximize2, 
  Minimize2,
  Presentation 
} from 'lucide-react';
import {
  TitleSlide,
  ChallengeSlide,
  DiscoverySlide,
  SolutionSlide,
  FeaturesSlide,
  ROISlide,
  HowItWorksSlide,
  ComparisonSlide,
  RoadmapSlide,
  SuccessSlide,
  CTASlide,
} from './pitch-slides';

const slides = [
  { id: 'title', component: TitleSlide, name: 'Overview' },
  { id: 'challenge', component: ChallengeSlide, name: 'Problems We Solve' },
  { id: 'discovery', component: DiscoverySlide, name: 'Discovery Framework' },
  { id: 'solution', component: SolutionSlide, name: 'Capabilities' },
  { id: 'features', component: FeaturesSlide, name: 'Features' },
  { id: 'roi', component: ROISlide, name: 'Business Impact' },
  { id: 'how-it-works', component: HowItWorksSlide, name: 'How It Works' },
  { id: 'comparison', component: ComparisonSlide, name: 'Why This Approach' },
  { id: 'roadmap', component: RoadmapSlide, name: 'Roadmap' },
  { id: 'success', component: SuccessSlide, name: 'Expected Outcomes' },
  { id: 'cta', component: CTASlide, name: 'Next Steps' },
];

export function PitchDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  }, []);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const handleExportPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('pitch-deck-container');
    if (!element) return;

    // Store current slide
    const originalSlide = currentSlide;
    
    // Create a container for all slides
    const pdfContainer = document.createElement('div');
    pdfContainer.style.width = '1280px';
    
    // Render each slide
    for (let i = 0; i < slides.length; i++) {
      setCurrentSlide(i);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const slideClone = element.cloneNode(true) as HTMLElement;
      slideClone.style.height = '720px';
      slideClone.style.pageBreakAfter = 'always';
      pdfContainer.appendChild(slideClone);
    }
    
    document.body.appendChild(pdfContainer);
    
    await html2pdf()
      .set({
        margin: 0,
        filename: 'sales-performance-tracker-pitch-deck.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'px', format: [1280, 720], orientation: 'landscape' },
        pagebreak: { mode: 'avoid-all' },
      })
      .from(pdfContainer)
      .save();
    
    document.body.removeChild(pdfContainer);
    setCurrentSlide(originalSlide);
  };

  const CurrentSlideComponent = slides[currentSlide].component;

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-background flex flex-col`}>
      {/* Header */}
      {!isFullscreen && (
        <div className="border-b bg-card/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Presentation className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold">Sales Performance Tracker</h1>
                <p className="text-xs text-muted-foreground">Pitch Deck</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsFullscreen(true)}
                className="gap-2"
              >
                <Maximize2 className="h-4 w-4" />
                Fullscreen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Slide Container */}
      <div className="flex-1 flex flex-col">
        <div 
          id="pitch-deck-container"
          className={`flex-1 ${isFullscreen ? '' : 'max-w-6xl mx-auto w-full my-8 rounded-xl border shadow-lg overflow-hidden'}`}
        >
          <div className="h-full bg-card relative">
            {/* Exit fullscreen button */}
            {isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(false)}
                className="absolute top-4 right-4 z-10"
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
            )}
            
            {/* Slide Content */}
            <div className="h-full">
              <CurrentSlideComponent />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className={`${isFullscreen ? 'absolute bottom-0 left-0 right-0' : ''} bg-card/50 backdrop-blur-sm border-t`}>
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Previous Button */}
              <Button
                variant="ghost"
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              {/* Slide Indicators */}
              <div className="flex items-center gap-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      index === currentSlide 
                        ? 'bg-primary w-8' 
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    aria-label={`Go to slide ${index + 1}: ${slide.name}`}
                  />
                ))}
              </div>

              {/* Next Button */}
              <Button
                variant="ghost"
                onClick={nextSlide}
                disabled={currentSlide === slides.length - 1}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Slide Counter & Name */}
            <div className="text-center mt-2">
              <p className="text-xs text-muted-foreground">
                {currentSlide + 1} / {slides.length} — {slides[currentSlide].name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

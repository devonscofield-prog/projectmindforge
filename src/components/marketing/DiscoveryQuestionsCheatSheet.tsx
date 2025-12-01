import { Button } from '@/components/ui/button';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const questions = [
  {
    category: 'Sales Productivity & Time',
    icon: '🕐',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    items: [
      {
        number: 1,
        question: 'What percentage of your reps\' time is currently spent on selling vs. administrative tasks like documentation?',
        painPoint: 'Time drain from manual work',
      },
      {
        number: 2,
        question: 'If your reps could get back 5-10 hours per week, what would that mean for pipeline generation?',
        painPoint: 'Lost selling capacity',
      },
      {
        number: 3,
        question: 'How much time do managers spend listening to calls vs. actually coaching?',
        painPoint: 'Manager bandwidth constraints',
      },
    ],
  },
  {
    category: 'Coaching & Methodology',
    icon: '📊',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    items: [
      {
        number: 4,
        question: 'How do you currently ensure consistent sales methodology execution across the team?',
        painPoint: 'Inconsistent execution',
      },
      {
        number: 5,
        question: 'What\'s your biggest challenge in scaling personalized coaching as the team grows?',
        painPoint: 'Coaching scalability',
      },
      {
        number: 6,
        question: 'If you could have every call analyzed for methodology adherence, what would that visibility be worth?',
        painPoint: 'Lack of visibility',
      },
    ],
  },
  {
    category: 'Revenue & Visibility',
    icon: '💰',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    items: [
      {
        number: 7,
        question: 'What\'s your current win rate, and what would a 5-10% improvement mean in revenue?',
        painPoint: 'Win rate potential',
      },
      {
        number: 8,
        question: 'How do you identify deals at risk before it\'s too late to course-correct?',
        painPoint: 'Deal risk visibility',
      },
      {
        number: 9,
        question: 'What visibility do you have into why deals are won or lost?',
        painPoint: 'Win/loss insights gap',
      },
      {
        number: 10,
        question: 'What data would you need to make more confident forecasting decisions?',
        painPoint: 'Forecasting accuracy',
      },
    ],
  },
];

export function DiscoveryQuestionsCheatSheet() {
  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('cheat-sheet-content');
    if (!element) return;

    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: 'discovery-questions-cheat-sheet.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(element)
      .save();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Hidden when printing */}
      <div className="print:hidden border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/marketing/pitch-deck">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Pitch Deck
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Cheat Sheet Content */}
      <div id="cheat-sheet-content" className="max-w-4xl mx-auto p-6 print:p-4 print:max-w-none">
        {/* Title Header */}
        <div className="text-center mb-6 print:mb-4">
          <h1 className="text-2xl font-bold print:text-xl">Discovery Questions Cheat Sheet</h1>
          <p className="text-muted-foreground text-sm mt-1">Sales Performance Tracker — Leadership Meeting Prep</p>
        </div>

        {/* Questions by Category */}
        <div className="space-y-6 print:space-y-4">
          {questions.map((category) => (
            <div key={category.category} className="space-y-3 print:space-y-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${category.bgColor} print:bg-gray-100`}>
                <span className="print:hidden">{category.icon}</span>
                <h2 className={`font-semibold text-sm ${category.color} print:text-black`}>
                  {category.category}
                </h2>
              </div>
              
              <div className="space-y-3 print:space-y-2 pl-2">
                {category.items.map((item) => (
                  <div key={item.number} className="border rounded-lg p-3 print:p-2 print:border-gray-300">
                    <div className="flex gap-3">
                      <span className="font-bold text-primary print:text-black shrink-0">
                        Q{item.number}:
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-tight">{item.question}</p>
                        <p className="text-xs text-muted-foreground mt-1 print:text-gray-500">
                          Pain point: {item.painPoint}
                        </p>
                      </div>
                    </div>
                    {/* Notes Section */}
                    <div className="mt-2 pt-2 border-t border-dashed print:border-gray-300">
                      <p className="text-xs text-muted-foreground print:text-gray-500 mb-1">Notes:</p>
                      <div className="h-8 print:h-12 border-b border-dotted print:border-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Follow-up Actions Section */}
        <div className="mt-6 print:mt-4 border-2 border-dashed rounded-lg p-4 print:p-3 print:border-gray-400">
          <h3 className="font-semibold text-sm mb-3">Follow-Up Action Items</h3>
          <div className="space-y-3">
            <div className="flex gap-2 items-start">
              <span className="text-muted-foreground">1.</span>
              <div className="flex-1 h-6 border-b border-dotted print:border-gray-400" />
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-muted-foreground">2.</span>
              <div className="flex-1 h-6 border-b border-dotted print:border-gray-400" />
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-muted-foreground">3.</span>
              <div className="flex-1 h-6 border-b border-dotted print:border-gray-400" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-muted-foreground print:text-gray-500">
          <p>Tip: Listen more than you talk. The goal is to uncover pain, not pitch features.</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

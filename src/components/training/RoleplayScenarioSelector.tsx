import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  DollarSign, 
  Cpu, 
  UserCircle2, 
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
  category: 'objection' | 'persona' | 'situation';
}

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'price-objection',
    name: 'Price Objection Focus',
    description: 'Practice handling budget and pricing concerns',
    icon: <DollarSign className="h-4 w-4" />,
    prompt: 'Focus heavily on price objections. Early in the call, express concern about budget constraints. Push back on pricing at least twice. Mention that a competitor quoted something lower. Only agree to move forward if the rep successfully handles the price objection with value justification.',
    category: 'objection',
  },
  {
    id: 'technical-deep-dive',
    name: 'Technical Deep-Dive',
    description: 'Demanding technical questions about integration',
    icon: <Cpu className="h-4 w-4" />,
    prompt: 'You are particularly technical-minded today. Ask specific questions about API integrations, security compliance (SOC2, HIPAA), data migration, and SSO support. Be skeptical of vague answers. You need detailed technical specifications before considering any next steps.',
    category: 'persona',
  },
  {
    id: 'executive-stakeholder',
    name: 'Executive Stakeholder',
    description: 'C-level with limited time and high expectations',
    icon: <UserCircle2 className="h-4 w-4" />,
    prompt: 'You are acting as a VP or C-level executive who was pulled into this call last minute. You have exactly 10 minutes. Be direct and impatient with fluff. Only care about business outcomes, ROI, and strategic value. If the rep wastes time on features without tying to outcomes, express visible frustration.',
    category: 'persona',
  },
  {
    id: 'competitor-evaluation',
    name: 'Competitor Evaluation',
    description: 'Actively comparing against specific competitors',
    icon: <Target className="h-4 w-4" />,
    prompt: 'You are actively evaluating two other vendors alongside this one. Mention the competitors by name (pick realistic ones for IT training: Pluralsight, LinkedIn Learning, Udemy Business). Ask how this solution is different. Push for a competitive comparison. If the rep speaks negatively about competitors, note it as a red flag.',
    category: 'situation',
  },
  {
    id: 'skeptical-due-to-past',
    name: 'Burned by Past Vendor',
    description: 'Highly skeptical due to previous bad experience',
    icon: <FileText className="h-4 w-4" />,
    prompt: 'You had a very bad experience with a similar vendor last year. It cost you money and credibility internally. Be openly skeptical and share this trauma early. Test whether the rep acknowledges your concern and differentiates meaningfully, or just plows through their pitch.',
    category: 'situation',
  },
];

interface RoleplayScenarioSelectorProps {
  scenarioPrompt: string;
  onScenarioChange: (prompt: string) => void;
}

export function RoleplayScenarioSelector({ 
  scenarioPrompt, 
  onScenarioChange 
}: RoleplayScenarioSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleTemplateSelect = (template: ScenarioTemplate) => {
    if (selectedTemplate === template.id) {
      // Deselect
      setSelectedTemplate(null);
      onScenarioChange('');
    } else {
      setSelectedTemplate(template.id);
      onScenarioChange(template.prompt);
    }
  };

  const handleCustomChange = (value: string) => {
    setSelectedTemplate(null);
    onScenarioChange(value);
  };

  const hasScenario = scenarioPrompt.trim().length > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Custom Scenario
            {hasScenario && (
              <Badge variant="secondary" className="ml-2">Active</Badge>
            )}
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {!isExpanded && (
          <p className="text-sm text-muted-foreground mt-1">
            Add a specific challenge or situation to practice
          </p>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Template Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SCENARIO_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                variant={selectedTemplate === template.id ? 'default' : 'outline'}
                className={cn(
                  "h-auto py-3 px-4 justify-start text-left",
                  selectedTemplate === template.id && "ring-2 ring-primary/50"
                )}
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "mt-0.5 shrink-0",
                    selectedTemplate === template.id 
                      ? "text-primary-foreground" 
                      : "text-muted-foreground"
                  )}>
                    {template.icon}
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className={cn(
                      "text-xs",
                      selectedTemplate === template.id 
                        ? "text-primary-foreground/80" 
                        : "text-muted-foreground"
                    )}>
                      {template.description}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or write your own
              </span>
            </div>
          </div>

          {/* Custom Input */}
          <Textarea
            placeholder="Describe a specific scenario, objection, or challenge you want to practice..."
            value={selectedTemplate ? '' : scenarioPrompt}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="min-h-[100px] resize-none"
            disabled={!!selectedTemplate}
          />

          {selectedTemplate && (
            <p className="text-xs text-muted-foreground">
              Using template: <span className="font-medium">{SCENARIO_TEMPLATES.find(t => t.id === selectedTemplate)?.name}</span>
              <button 
                onClick={() => { setSelectedTemplate(null); onScenarioChange(''); }}
                className="ml-2 text-primary hover:underline"
              >
                Clear
              </button>
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

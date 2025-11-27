import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, AlertTriangle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { getAiMode, setAiMode, AiMode } from '@/api/appSettings';

export function AiModeCard() {
  const [mode, setMode] = useState<AiMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchMode();
  }, []);

  const fetchMode = async () => {
    try {
      const currentMode = await getAiMode();
      setMode(currentMode);
    } catch (error) {
      console.error('Failed to fetch AI mode:', error);
      setMode('mock');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode: AiMode) => {
    if (newMode === mode || updating) return;
    
    setUpdating(true);
    const previousMode = mode;
    
    // Optimistic update
    setMode(newMode);
    
    try {
      await setAiMode(newMode);
      toast.success(`AI mode set to ${newMode === 'mock' ? 'Mock' : 'Real'}`);
    } catch (error) {
      // Revert on error
      setMode(previousMode);
      const message = error instanceof Error ? error.message : 'Failed to update AI mode';
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Mode
        </CardTitle>
        <CardDescription>
          Control whether AI analysis uses mock or real AI calls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Mode Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Current Mode:</span>
          <Badge variant={mode === 'real' ? 'default' : 'secondary'}>
            {mode === 'real' ? 'Real AI' : 'Mock'}
          </Badge>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'mock' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('mock')}
            disabled={updating}
            className="flex-1"
          >
            Mock
          </Button>
          <Button
            variant={mode === 'real' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('real')}
            disabled={updating}
            className="flex-1"
          >
            <Zap className="mr-1 h-3 w-3" />
            Real AI
          </Button>
        </div>

        {/* Mode-specific message */}
        {mode === 'mock' ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <span className="text-muted-foreground">
              Mock mode uses deterministic sample outputs for testing. Analyses are not based on live AI calls.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 text-sm">
            <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-muted-foreground">
              Real mode calls AI to generate live analyses. This may incur usage costs.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Check, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useColorScheme, type ColorScheme } from '@/hooks/useColorScheme';
import { cn } from '@/lib/utils';

export function ColorSchemeSelector() {
  const { colorScheme, setColorScheme, colorSchemes } = useColorScheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Color Scheme
        </CardTitle>
        <CardDescription>Choose your preferred color theme</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {colorSchemes.map((scheme) => {
            const isSelected = colorScheme === scheme.id;
            return (
              <button
                key={scheme.id}
                onClick={() => setColorScheme(scheme.id as ColorScheme)}
                className={cn(
                  'relative flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left',
                  'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                
                {/* Color Preview */}
                <div className="flex gap-2 mb-3">
                  <div
                    className="h-8 w-8 rounded-md shadow-sm"
                    style={{ backgroundColor: scheme.preview.primary }}
                    title="Primary"
                  />
                  <div
                    className="h-8 w-8 rounded-md shadow-sm"
                    style={{ backgroundColor: scheme.preview.accent }}
                    title="Accent"
                  />
                  <div
                    className="h-8 w-8 rounded-md shadow-sm"
                    style={{ backgroundColor: scheme.preview.sidebar }}
                    title="Sidebar"
                  />
                </div>
                
                <p className="font-medium">{scheme.name}</p>
                <p className="text-sm text-muted-foreground">{scheme.description}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

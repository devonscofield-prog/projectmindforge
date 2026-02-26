import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { Stakeholder, influenceLevelLabels, StakeholderInfluenceLevel } from '@/api/stakeholders';
import {
  StakeholderRelationship,
  RelationshipType,
  relationshipTypeLabels,
  relationshipTypeColors,
  deleteRelationship,
} from '@/api/stakeholderRelationships';
import { AddRelationshipDialog } from './AddRelationshipDialog';
import {
  Plus,
  GitBranch,
  Crown,
  Trash2,
  Users,
  ArrowRight,
} from 'lucide-react';

interface StakeholderRelationshipMapProps {
  stakeholders: Stakeholder[];
  relationships: StakeholderRelationship[];
  prospectId: string;
  repId: string;
  onRelationshipsChanged: () => void;
  onStakeholderClick?: (stakeholder: Stakeholder) => void;
}

const influenceLevelColors: Record<StakeholderInfluenceLevel, string> = {
  final_dm: 'hsl(var(--chart-1))',
  secondary_dm: 'hsl(var(--chart-2))',
  heavy_influencer: 'hsl(var(--chart-3))',
  light_influencer: 'hsl(var(--muted-foreground))',
  self_pay: 'hsl(var(--chart-4))',
};

interface NodePosition {
  x: number;
  y: number;
}

export function StakeholderRelationshipMap({
  stakeholders,
  relationships,
  prospectId,
  repId,
  onRelationshipsChanged,
  onStakeholderClick,
}: StakeholderRelationshipMapProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [_selectedRelationship, setSelectedRelationship] = useState<StakeholderRelationship | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Calculate node positions using a simple hierarchical layout
  const nodePositions = useMemo(() => {
    const positions: Record<string, NodePosition> = {};
    const width = 500;
    const height = 400;
    const padding = 60;

    // Group stakeholders by influence level for hierarchical layout
    const levels: Record<string, Stakeholder[]> = {
      final_dm: [],
      secondary_dm: [],
      heavy_influencer: [],
      light_influencer: [],
    };

    stakeholders.forEach((s) => {
      const level = s.influence_level || 'light_influencer';
      levels[level].push(s);
    });

    const levelOrder = ['final_dm', 'secondary_dm', 'heavy_influencer', 'light_influencer'];
    const usedLevels = levelOrder.filter((l) => levels[l].length > 0);
    const levelHeight = (height - padding * 2) / Math.max(usedLevels.length - 1, 1);

    usedLevels.forEach((level, levelIndex) => {
      const stakeholdersInLevel = levels[level];
      const levelWidth = width - padding * 2;
      const spacing = levelWidth / Math.max(stakeholdersInLevel.length + 1, 2);

      stakeholdersInLevel.forEach((stakeholder, index) => {
        positions[stakeholder.id] = {
          x: padding + spacing * (index + 1),
          y: padding + levelIndex * levelHeight,
        };
      });
    });

    return positions;
  }, [stakeholders]);

  const handleDeleteRelationship = async (relationshipId: string) => {
    try {
      await deleteRelationship(relationshipId);
      toast.success('Relationship deleted');
      setSelectedRelationship(null);
      onRelationshipsChanged();
    } catch {
      toast.error('Failed to delete relationship');
    }
  };

  const getLineStyle = (type: RelationshipType) => {
    switch (type) {
      case 'reports_to':
        return { strokeDasharray: 'none', markerEnd: 'url(#arrowhead)' };
      case 'influences':
        return { strokeDasharray: '8,4', markerEnd: 'url(#arrowhead)' };
      case 'collaborates_with':
        return { strokeDasharray: '4,4', markerEnd: 'none' };
      case 'opposes':
        return { strokeDasharray: '2,2', markerEnd: 'url(#arrowhead-red)' };
    }
  };

  const getStakeholderById = useCallback(
    (id: string) => stakeholders.find((s) => s.id === id),
    [stakeholders]
  );

  if (stakeholders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Relationship Map
          </CardTitle>
          <CardDescription>Visualize stakeholder connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Add stakeholders first to create a relationship map
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Relationship Map
          </CardTitle>
          <CardDescription>Visualize stakeholder connections</CardDescription>
        </div>
        {stakeholders.length >= 2 && (
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Relationship
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {stakeholders.length < 2 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Add at least 2 stakeholders to create relationships
            </p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-0.5 bg-primary" />
                <span className="text-muted-foreground">Reports To</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-0.5 bg-primary" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(var(--chart-2)) 0, hsl(var(--chart-2)) 6px, transparent 6px, transparent 10px)' }} />
                <span className="text-muted-foreground">Influences</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(var(--chart-3)) 0, hsl(var(--chart-3)) 3px, transparent 3px, transparent 6px)' }} />
                <span className="text-muted-foreground">Collaborates</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-0.5 bg-destructive" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(var(--destructive)) 0, hsl(var(--destructive)) 2px, transparent 2px, transparent 4px)' }} />
                <span className="text-muted-foreground">Opposes</span>
              </div>
            </div>

            {/* SVG Map */}
            <div className="relative rounded-lg border bg-muted/20 overflow-hidden">
              <svg width="100%" height="400" viewBox="0 0 500 400" className="select-none">
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="hsl(var(--primary))"
                    />
                  </marker>
                  <marker
                    id="arrowhead-red"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="hsl(var(--destructive))"
                    />
                  </marker>
                </defs>

                {/* Relationship Lines */}
                {relationships.map((rel) => {
                  const source = nodePositions[rel.source_stakeholder_id];
                  const target = nodePositions[rel.target_stakeholder_id];
                  if (!source || !target) return null;

                  const lineStyle = getLineStyle(rel.relationship_type);
                  const color = relationshipTypeColors[rel.relationship_type];

                  // Calculate offset for arrow to not overlap with node
                  const dx = target.x - source.x;
                  const dy = target.y - source.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const nodeRadius = 28;
                  const targetX = target.x - (dx / len) * nodeRadius;
                  const targetY = target.y - (dy / len) * nodeRadius;
                  const sourceX = source.x + (dx / len) * nodeRadius;
                  const sourceY = source.y + (dy / len) * nodeRadius;

                  return (
                    <Popover key={rel.id}>
                      <PopoverTrigger asChild>
                        <line
                          x1={sourceX}
                          y1={sourceY}
                          x2={targetX}
                          y2={targetY}
                          stroke={color}
                          strokeWidth={rel.strength > 6 ? 3 : 2}
                          strokeDasharray={lineStyle.strokeDasharray}
                          markerEnd={lineStyle.markerEnd}
                          className="cursor-pointer hover:stroke-primary transition-colors"
                          style={{ opacity: rel.strength / 10 + 0.3 }}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{getStakeholderById(rel.source_stakeholder_id)?.name}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{getStakeholderById(rel.target_stakeholder_id)?.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {relationshipTypeLabels[rel.relationship_type]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Strength: {rel.strength}/10
                            </span>
                          </div>
                          {rel.notes && (
                            <p className="text-xs text-muted-foreground">{rel.notes}</p>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            onClick={() => handleDeleteRelationship(rel.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}

                {/* Stakeholder Nodes */}
                {stakeholders.map((stakeholder) => {
                  const pos = nodePositions[stakeholder.id];
                  if (!pos) return null;

                  const level = stakeholder.influence_level || 'light_influencer';
                  const color = influenceLevelColors[level];
                  const isHovered = hoveredNodeId === stakeholder.id;

                  return (
                    <g
                      key={stakeholder.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredNodeId(stakeholder.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onClick={() => onStakeholderClick?.(stakeholder)}
                    >
                      {/* Node circle */}
                      <circle
                        r={isHovered ? 32 : 28}
                        fill="hsl(var(--background))"
                        stroke={color}
                        strokeWidth={stakeholder.is_primary_contact ? 4 : 2}
                        className="transition-all duration-200"
                      />
                      
                      {/* Primary contact crown */}
                      {stakeholder.is_primary_contact && (
                        <g transform="translate(0, -40)">
                          <Crown className="h-4 w-4" fill="hsl(var(--chart-4))" stroke="hsl(var(--chart-4))" />
                        </g>
                      )}

                      {/* Initials */}
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        className="text-xs font-medium fill-foreground pointer-events-none"
                      >
                        {stakeholder.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </text>

                      {/* Name label */}
                      <text
                        y={42}
                        textAnchor="middle"
                        className="text-[10px] fill-muted-foreground pointer-events-none"
                      >
                        {stakeholder.name.length > 15 
                          ? stakeholder.name.slice(0, 14) + '...' 
                          : stakeholder.name}
                      </text>

                      {/* Job title */}
                      {stakeholder.job_title && (
                        <text
                          y={54}
                          textAnchor="middle"
                          className="text-[9px] fill-muted-foreground/70 pointer-events-none"
                        >
                          {stakeholder.job_title.length > 18
                            ? stakeholder.job_title.slice(0, 17) + '...'
                            : stakeholder.job_title}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Influence Level Legend */}
            <div className="flex flex-wrap gap-3 mt-4 text-xs">
              {(['final_dm', 'secondary_dm', 'heavy_influencer', 'light_influencer'] as StakeholderInfluenceLevel[]).map((level) => (
                <div key={level} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-full border-2"
                    style={{ borderColor: influenceLevelColors[level] }}
                  />
                  <span className="text-muted-foreground">{influenceLevelLabels[level]}</span>
                </div>
              ))}
            </div>

            {relationships.length === 0 && (
              <div className="text-center py-4 mt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  No relationships defined yet. Click "Add Relationship" to connect stakeholders.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AddRelationshipDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        stakeholders={stakeholders}
        prospectId={prospectId}
        repId={repId}
        onRelationshipAdded={onRelationshipsChanged}
      />
    </Card>
  );
}

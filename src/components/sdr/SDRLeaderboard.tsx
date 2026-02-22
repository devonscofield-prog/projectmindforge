import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, Medal, Award, ArrowUp, ArrowDown, Minus, ArrowUpDown } from 'lucide-react';
import { subDays } from 'date-fns';
import type { SDRCallListItem } from '@/hooks/sdr/types';
import type { SDRTeamMemberWithProfile } from '@/hooks/sdr/types';

interface LeaderboardEntry {
  userId: string;
  name: string;
  avgScore: number;
  totalGraded: number;
  meetingsSet: number;
  trend: 'up' | 'down' | 'stable';
}

type SortKey = 'rank' | 'name' | 'avgScore' | 'totalGraded' | 'meetingsSet';

interface SDRLeaderboardProps {
  members: SDRTeamMemberWithProfile[];
  teamCalls: SDRCallListItem[];
}

function computeAvgScore(
  grades: Array<{
    opener_score: number | null;
    engagement_score: number | null;
    objection_handling_score: number | null;
    appointment_setting_score: number | null;
    professionalism_score: number | null;
  }>,
): number {
  if (grades.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const g of grades) {
    const dims = [
      g.opener_score,
      g.engagement_score,
      g.objection_handling_score,
      g.appointment_setting_score,
      g.professionalism_score,
    ].filter((s): s is number => typeof s === 'number');
    if (dims.length > 0) {
      total += dims.reduce((a, b) => a + b, 0) / dims.length;
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
}

export function SDRLeaderboard({ members, teamCalls }: SDRLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  const entries = useMemo(() => {
    const now = new Date();
    const cutoff30 = subDays(now, 30).toLocaleDateString('en-CA');
    const cutoff60 = subDays(now, 60).toLocaleDateString('en-CA');

    const result: LeaderboardEntry[] = members.map((m) => {
      const memberCalls = teamCalls.filter((c) => c.sdr_id === m.user_id);

      // Current period (last 30 days)
      const currentGrades = memberCalls
        .filter((c) => c.created_at.slice(0, 10) >= cutoff30)
        .flatMap((c) => c.sdr_call_grades ?? []);

      // Previous period (30-60 days ago)
      const prevGrades = memberCalls
        .filter((c) => {
          const d = c.created_at.slice(0, 10);
          return d >= cutoff60 && d < cutoff30;
        })
        .flatMap((c) => c.sdr_call_grades ?? []);

      const currentAvg = computeAvgScore(currentGrades);
      const prevAvg = computeAvgScore(prevGrades);

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (prevGrades.length >= 2 && currentGrades.length >= 2) {
        const diff = currentAvg - prevAvg;
        if (diff > 0.3) trend = 'up';
        else if (diff < -0.3) trend = 'down';
      }

      return {
        userId: m.user_id,
        name: m.profiles?.name || m.profiles?.email || 'Unknown',
        avgScore: Math.round(currentAvg * 10) / 10,
        totalGraded: currentGrades.length,
        meetingsSet: currentGrades.filter((g) => g.meeting_scheduled === true).length,
        trend,
      };
    });

    // Default rank by avgScore desc (with totalGraded as tiebreaker)
    result.sort((a, b) => b.avgScore - a.avgScore || b.totalGraded - a.totalGraded);

    return result;
  }, [members, teamCalls]);

  const sortedEntries = useMemo(() => {
    if (sortKey === 'rank') return sortAsc ? entries : [...entries].reverse();

    const sorted = [...entries].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      return (a[sortKey] as number) - (b[sortKey] as number);
    });

    // For numeric columns, descending is more natural default
    if (sortKey !== 'name') {
      if (sortAsc) sorted.reverse();
    } else if (!sortAsc) {
      sorted.reverse();
    }

    return sorted;
  }, [entries, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4" style={{ color: '#FFD700' }} />;
    if (rank === 2) return <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />;
    if (rank === 3) return <Award className="h-4 w-4" style={{ color: '#CD7F32' }} />;
    return <span className="text-sm text-muted-foreground pl-0.5">{rank}</span>;
  };

  const trendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <ArrowUp className="h-3.5 w-3.5 text-green-500" />;
    if (trend === 'down') return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const getAriaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    if (key === 'name') return sortAsc ? 'ascending' : 'descending';
    // For numeric columns, sortAsc=true means descending (higher first)
    return sortAsc ? 'descending' : 'ascending';
  };

  const SortableHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(sortKeyValue)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  if (members.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Team Leaderboard
        </CardTitle>
        <CardDescription>Performance rankings — last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 pl-6" aria-sort={getAriaSort('rank')}>
                  <SortableHeader label="#" sortKeyValue="rank" />
                </TableHead>
                <TableHead aria-sort={getAriaSort('name')}>
                  <SortableHeader label="Name" sortKeyValue="name" />
                </TableHead>
                <TableHead className="text-right" aria-sort={getAriaSort('avgScore')}>
                  <SortableHeader label="Avg Score" sortKeyValue="avgScore" />
                </TableHead>
                <TableHead className="text-right" aria-sort={getAriaSort('totalGraded')}>
                  <SortableHeader label="Graded" sortKeyValue="totalGraded" />
                </TableHead>
                <TableHead className="text-right" aria-sort={getAriaSort('meetingsSet')}>
                  <SortableHeader label="Meetings" sortKeyValue="meetingsSet" />
                </TableHead>
                <TableHead className="w-14 text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((entry) => {
                const naturalRank = entries.indexOf(entry) + 1;
                return (
                  <TableRow key={entry.userId}>
                    <TableCell className="pl-6">
                      <div className="flex items-center">{rankIcon(naturalRank)}</div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{entry.name}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {entry.totalGraded > 0 ? entry.avgScore : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{entry.totalGraded}</TableCell>
                    <TableCell className="text-right text-sm">{entry.meetingsSet}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">{trendIcon(entry.trend)}</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile stacked cards */}
        <div className="md:hidden space-y-1 p-4">
          {sortedEntries.map((entry) => {
            const naturalRank = entries.indexOf(entry) + 1;
            return (
              <div
                key={entry.userId}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center w-6">{rankIcon(naturalRank)}</div>
                  <div>
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.totalGraded} calls &middot; {entry.meetingsSet} mtgs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {entry.totalGraded > 0 ? entry.avgScore : '—'}
                  </span>
                  {trendIcon(entry.trend)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

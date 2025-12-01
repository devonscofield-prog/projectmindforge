export interface ROIInputs {
  teamSize: number;
  avgDealValue: number;
  dealsPerMonthPerRep: number;
  currentWinRate: number;
  adminHoursPerWeek: number;
  coachingHoursPerMonth: number;
}

export interface TimeSavings {
  hoursPerRepPerMonth: number;
  totalMonthlyHours: number;
  fteEquivalent: number;
  annualValueSaved: number;
}

export interface WinRateImprovement {
  percentageIncrease: number;
  newWinRate: number;
  additionalDealsPerMonth: number;
}

export interface RevenueImpact {
  additionalMonthlyRevenue: number;
  annualRevenueImpact: number;
}

export interface CoachingEfficiency {
  managerHoursFreed: number;
  scalabilityMultiplier: number;
}

export interface TotalROI {
  year1Value: number;
  paybackPeriodMonths: number;
  roiPercentage: number;
}

export interface ROIResults {
  timeSavings: TimeSavings;
  winRateImprovement: WinRateImprovement;
  revenueImpact: RevenueImpact;
  coachingEfficiency: CoachingEfficiency;
  totalROI: TotalROI;
  monthlyProjection: MonthlyProjection[];
}

export interface MonthlyProjection {
  month: number;
  cumulativeValue: number;
  timeSavingsValue: number;
  revenueValue: number;
}

// Constants based on industry benchmarks
const ADMIN_TIME_REDUCTION = 0.70; // 70% reduction in documentation time
const HOURLY_COST = 75; // Average hourly cost of a sales rep
const WIN_RATE_IMPROVEMENT_FACTOR = 0.10; // 10% average improvement
const COACHING_AI_REPLACEMENT = 0.80; // 80% of manual coaching can be AI-assisted
const PLATFORM_MONTHLY_COST_PER_USER = 150; // Estimated platform cost

export function calculateROI(inputs: ROIInputs): ROIResults {
  const {
    teamSize,
    avgDealValue,
    dealsPerMonthPerRep,
    currentWinRate,
    adminHoursPerWeek,
    coachingHoursPerMonth,
  } = inputs;

  // Time Savings Calculations
  const hoursPerRepPerMonth = adminHoursPerWeek * 4 * ADMIN_TIME_REDUCTION;
  const totalMonthlyHours = hoursPerRepPerMonth * teamSize;
  const fteEquivalent = totalMonthlyHours / 160;
  const annualValueSaved = totalMonthlyHours * 12 * HOURLY_COST;

  const timeSavings: TimeSavings = {
    hoursPerRepPerMonth: Math.round(hoursPerRepPerMonth * 10) / 10,
    totalMonthlyHours: Math.round(totalMonthlyHours),
    fteEquivalent: Math.round(fteEquivalent * 10) / 10,
    annualValueSaved: Math.round(annualValueSaved),
  };

  // Win Rate Improvement Calculations
  // Scale improvement based on current win rate (lower rates see bigger improvements)
  const improvementScale = currentWinRate < 30 ? 1.5 : currentWinRate < 50 ? 1.0 : 0.7;
  const percentageIncrease = WIN_RATE_IMPROVEMENT_FACTOR * improvementScale * 100;
  const newWinRate = Math.min(currentWinRate * (1 + WIN_RATE_IMPROVEMENT_FACTOR * improvementScale), 100);
  const currentDealsWon = (dealsPerMonthPerRep * teamSize * currentWinRate) / 100;
  const newDealsWon = (dealsPerMonthPerRep * teamSize * newWinRate) / 100;
  const additionalDealsPerMonth = newDealsWon - currentDealsWon;

  const winRateImprovement: WinRateImprovement = {
    percentageIncrease: Math.round(percentageIncrease * 10) / 10,
    newWinRate: Math.round(newWinRate * 10) / 10,
    additionalDealsPerMonth: Math.round(additionalDealsPerMonth * 10) / 10,
  };

  // Revenue Impact Calculations
  const additionalMonthlyRevenue = additionalDealsPerMonth * avgDealValue;
  const annualRevenueImpact = additionalMonthlyRevenue * 12;

  const revenueImpact: RevenueImpact = {
    additionalMonthlyRevenue: Math.round(additionalMonthlyRevenue),
    annualRevenueImpact: Math.round(annualRevenueImpact),
  };

  // Coaching Efficiency Calculations
  const managerHoursFreed = coachingHoursPerMonth * teamSize * COACHING_AI_REPLACEMENT;
  // With AI assistance, a manager can effectively coach more reps
  const scalabilityMultiplier = 1 / (1 - COACHING_AI_REPLACEMENT);

  const coachingEfficiency: CoachingEfficiency = {
    managerHoursFreed: Math.round(managerHoursFreed),
    scalabilityMultiplier: Math.round(scalabilityMultiplier * 10) / 10,
  };

  // Total ROI Calculations
  const monthlyTimeSavingsValue = totalMonthlyHours * HOURLY_COST;
  const monthlyRevenueValue = additionalMonthlyRevenue;
  const monthlyTotalValue = monthlyTimeSavingsValue + monthlyRevenueValue;
  const year1Value = monthlyTotalValue * 12;
  
  const platformAnnualCost = teamSize * PLATFORM_MONTHLY_COST_PER_USER * 12;
  const roiPercentage = ((year1Value - platformAnnualCost) / platformAnnualCost) * 100;
  
  // Calculate payback period in months
  const monthlyPlatformCost = teamSize * PLATFORM_MONTHLY_COST_PER_USER;
  const paybackPeriodMonths = monthlyPlatformCost > 0 
    ? Math.ceil(platformAnnualCost / monthlyTotalValue)
    : 0;

  const totalROI: TotalROI = {
    year1Value: Math.round(year1Value),
    paybackPeriodMonths: Math.min(paybackPeriodMonths, 12),
    roiPercentage: Math.round(roiPercentage),
  };

  // Generate 12-month projection
  const monthlyProjection: MonthlyProjection[] = [];
  let cumulativeValue = 0;
  
  for (let month = 1; month <= 12; month++) {
    // Ramp up factor - benefits increase as team adopts platform
    const rampUpFactor = Math.min(month / 3, 1); // Full benefits by month 3
    const monthTimeSavings = monthlyTimeSavingsValue * rampUpFactor;
    const monthRevenue = monthlyRevenueValue * rampUpFactor;
    cumulativeValue += monthTimeSavings + monthRevenue;
    
    monthlyProjection.push({
      month,
      cumulativeValue: Math.round(cumulativeValue),
      timeSavingsValue: Math.round(monthTimeSavings),
      revenueValue: Math.round(monthRevenue),
    });
  }

  return {
    timeSavings,
    winRateImprovement,
    revenueImpact,
    coachingEfficiency,
    totalROI,
    monthlyProjection,
  };
}

export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(1);
}

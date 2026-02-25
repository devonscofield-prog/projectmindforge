import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard } from './kpi-card';
import { Phone } from 'lucide-react';

describe('KPICard', () => {
  it('should render title and formatted number value', () => {
    render(<KPICard title="Calls Made" value={50} goal={100} />);
    expect(screen.getByText('Calls Made')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('/ 100')).toBeInTheDocument();
  });

  it('should render currency formatted values', () => {
    render(<KPICard title="Revenue" value={25000} goal={50000} format="currency" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$25,000')).toBeInTheDocument();
    expect(screen.getByText('/ $50,000')).toBeInTheDocument();
  });

  it('should render percentage formatted values', () => {
    render(<KPICard title="Conversion" value={75} goal={100} format="percentage" />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('/ 100%')).toBeInTheDocument();
  });

  it('should display completion percentage', () => {
    render(<KPICard title="Progress" value={30} goal={100} />);
    expect(screen.getByText('30% complete')).toBeInTheDocument();
  });

  it('should handle zero goal without crashing', () => {
    render(<KPICard title="Zero Goal" value={10} goal={0} />);
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });
});

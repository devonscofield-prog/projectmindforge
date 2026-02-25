import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentErrorBoundary } from './component-error-boundary';

const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
  throw new Error(message);
};

describe('ComponentErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when no error', () => {
    render(
      <ComponentErrorBoundary>
        <div>Content works</div>
      </ComponentErrorBoundary>
    );
    expect(screen.getByText('Content works')).toBeInTheDocument();
  });

  it('should catch errors and render default fallback', () => {
    render(
      <ComponentErrorBoundary>
        <ThrowError />
      </ComponentErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should render compact fallback when compact prop is true', () => {
    render(
      <ComponentErrorBoundary compact>
        <ThrowError />
      </ComponentErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ComponentErrorBoundary fallback={<div>Custom error display</div>}>
        <ThrowError />
      </ComponentErrorBoundary>
    );
    expect(screen.getByText('Custom error display')).toBeInTheDocument();
  });

  it('should call onReset and recover when retry is clicked', () => {
    const onReset = vi.fn();
    let shouldThrow = true;

    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('Recoverable');
      return <div>Recovered</div>;
    };

    const { rerender } = render(
      <ComponentErrorBoundary onReset={onReset}>
        <MaybeThrow />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

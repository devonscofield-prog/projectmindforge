import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryErrorBoundary } from './query-error-boundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ThrowError = () => {
  throw new Error('Query error');
};

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('QueryErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when no error', () => {
    renderWithQueryClient(
      <QueryErrorBoundary>
        <div>Query content</div>
      </QueryErrorBoundary>
    );
    expect(screen.getByText('Query content')).toBeInTheDocument();
  });

  it('should catch errors and render error fallback', () => {
    renderWithQueryClient(
      <QueryErrorBoundary>
        <ThrowError />
      </QueryErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    renderWithQueryClient(
      <QueryErrorBoundary fallback={<div>Custom query error</div>}>
        <ThrowError />
      </QueryErrorBoundary>
    );
    expect(screen.getByText('Custom query error')).toBeInTheDocument();
  });
});

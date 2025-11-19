import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock the Intake component to avoid deep rendering and dependency issues
vi.mock('./intake/Intake.jsx', () => ({
    default: () => <div data-testid="intake-mock">Intake Component</div>,
}));

describe('App', () => {
    it('renders without crashing', () => {
        const { container } = render(<App />);
        expect(container.firstChild).toHaveClass('container');
    });

    it('renders the Intake component', () => {
        render(<App />);
        expect(screen.getByTestId('intake-mock')).toBeInTheDocument();
    });
});

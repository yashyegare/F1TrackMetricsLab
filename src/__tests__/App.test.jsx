import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock Leaflet to avoid real map tile requests in tests
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  CircleMarker: () => null,
  useMap: () => ({ flyTo: vi.fn() }),
}));

// Mock Three.js Canvas to avoid WebGL in tests
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({ gl: { render: vi.fn() }, camera: { position: { set: vi.fn() } } }),
}));

describe('App', () => {
  test('renders landing page by default', async () => {
    render(<App />);
    expect(screen.getByText(/F1 Track/)).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  test('renders sidebar with circuit list', async () => {
    render(<App />);
    // Circuits are statically imported, so they render immediately
    expect(screen.getByText('Albert Park Circuit')).toBeInTheDocument();
    expect(screen.getByText('Circuit de Monaco')).toBeInTheDocument();
  });

  test('mode toggle switches between views', async () => {
    const user = userEvent.setup();
    render(<App />);

    const mapBtn = screen.getByText('Map');
    await user.click(mapBtn);
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    // Verify the map view has a Leaflet container
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('search filters circuits', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('Albert Park Circuit')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search circuits or cities…');
    await user.type(searchInput, 'Monaco');

    await waitFor(() => {
      expect(screen.queryByText('Albert Park Circuit')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Circuit de Monaco')).toBeInTheDocument();
  });

  test('search input exists and is accessible', async () => {
    render(<App />);

    const searchInput = screen.getByPlaceholderText('Search circuits or cities…');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toBeEnabled();
  });

  test('unit toggle buttons exist', async () => {
    render(<App />);

    expect(screen.getByText('km / m')).toBeInTheDocument();
    expect(screen.getByText('mi / ft')).toBeInTheDocument();
  });
});

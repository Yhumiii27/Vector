import { describe, expect, it } from 'vitest';
import { CONTINENTS, MAP_H, MAP_W, arc, pathOf, project } from './geo';

describe('map projection', () => {
  it('equirectangular corners and centre', () => {
    expect(project(-180, 90)).toEqual({ x: 0, y: 0 });
    expect(project(180, -90)).toEqual({ x: MAP_W, y: MAP_H });
    expect(project(0, 0)).toEqual({ x: 500, y: 250 });
  });
  it('outlines and arcs are SVG paths', () => {
    expect(pathOf(CONTINENTS[0])).toMatch(/^M[\d.]+,[\d.]+ L.* Z$/);
    expect(arc({ x: 0, y: 100 }, { x: 100, y: 100 })).toBe('M0.0,100.0 Q50.0,75.0 100.0,100.0');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises before importing GuideEngine
vi.mock('fs/promises', () => ({
  readFile: vi.fn(async () => {
    throw new Error('ENOENT');
  }),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}));

import { GuideEngine } from '../../src/guides/GuideEngine';
import * as fs from 'fs/promises';

describe('GuideEngine', () => {
  let engine: GuideEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new GuideEngine();
  });

  describe('getGuides()', () => {
    it('returns all 4 bundled guides', () => {
      const guides = engine.getGuides();
      expect(guides).toHaveLength(4);
    });

    it('includes expected guide ids', () => {
      const ids = engine.getGuides().map((g) => g.id);
      expect(ids).toContain('getting-started');
      expect(ids).toContain('projects-files-context');
      expect(ids).toContain('sharing-context');
      expect(ids).toContain('triage-ideas');
    });
  });

  describe('getGuide()', () => {
    it('returns correct guide for known id', () => {
      const guide = engine.getGuide('getting-started');
      expect(guide).toBeDefined();
      expect(guide!.title).toBe('Getting Started with PM Code');
    });

    it('returns undefined for unknown id', () => {
      expect(engine.getGuide('nonexistent')).toBeUndefined();
    });
  });

  describe('guide content', () => {
    it('all guides have non-empty steps', () => {
      for (const guide of engine.getGuides()) {
        expect(guide.steps.length).toBeGreaterThan(0);
      }
    });

    it('each step has title and content', () => {
      for (const guide of engine.getGuides()) {
        for (const step of guide.steps) {
          expect(step.title).toBeTruthy();
          expect(step.content).toBeTruthy();
        }
      }
    });

    it('"getting-started" guide has 4 steps', () => {
      const guide = engine.getGuide('getting-started')!;
      expect(guide.steps).toHaveLength(4);
    });

    it('"projects-files-context" guide has 6 steps', () => {
      const guide = engine.getGuide('projects-files-context')!;
      expect(guide.steps).toHaveLength(6);
    });

    it('"sharing-context" guide has 7 steps', () => {
      const guide = engine.getGuide('sharing-context')!;
      expect(guide.steps).toHaveLength(7);
    });

    it('"triage-ideas" guide has 6 steps', () => {
      const guide = engine.getGuide('triage-ideas')!;
      expect(guide.steps).toHaveLength(6);
    });
  });

  describe('completeStep()', () => {
    it('marks step as completed', async () => {
      await engine.completeStep('getting-started', 0);
      const progress = await engine.getProgress('getting-started');
      expect(progress.completedSteps).toContain(0);
    });

    it('does not duplicate completed steps', async () => {
      await engine.completeStep('getting-started', 0);
      await engine.completeStep('getting-started', 0);
      const progress = await engine.getProgress('getting-started');
      expect(progress.completedSteps.filter((s) => s === 0)).toHaveLength(1);
    });

    it('persists progress to file via fs', async () => {
      await engine.completeStep('getting-started', 0);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);
      expect(written['getting-started'].completedSteps).toContain(0);
    });
  });

  describe('resetProgress()', () => {
    it('clears all progress for a guide', async () => {
      await engine.completeStep('getting-started', 0);
      await engine.completeStep('getting-started', 1);
      await engine.resetProgress('getting-started');
      const progress = await engine.getProgress('getting-started');
      expect(progress.completedSteps).toHaveLength(0);
      expect(progress.currentStep).toBe(0);
    });
  });

  describe('getProgress()', () => {
    it('returns default progress for unstarted guide', async () => {
      const progress = await engine.getProgress('getting-started');
      expect(progress.guideId).toBe('getting-started');
      expect(progress.completedSteps).toHaveLength(0);
      expect(progress.currentStep).toBe(0);
    });
  });
});

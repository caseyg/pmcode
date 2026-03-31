import * as assert from 'assert';
import {
  ActivityBar,
  SideBarView,
  Workbench,
} from 'vscode-extension-tester';

describe('PM Code Sidebar', () => {
  it('should show PM Code activity bar icon', async function () {
    this.timeout(30000);
    const activityBar = new ActivityBar();
    const controls = await activityBar.getViewControls();
    const names = await Promise.all(controls.map((c) => c.getTitle()));
    assert.ok(names.includes('PM Code'), 'PM Code icon should appear in activity bar');
  });

  it('should open sidebar when clicking activity bar icon', async function () {
    this.timeout(30000);
    const activityBar = new ActivityBar();
    const control = await activityBar.getViewControl('PM Code');
    assert.ok(control, 'PM Code view control should exist');
    await control!.openView();

    const sideBar = new SideBarView();
    const title = await sideBar.getTitlePart().getTitle();
    assert.ok(title.includes('PM Code'), 'Sidebar title should include PM Code');
  });
});

describe('PM Code Commands', () => {
  it('should find PM Code commands in command palette', async function () {
    this.timeout(30000);
    const workbench = new Workbench();
    const input = await workbench.openCommandPrompt();
    await input.setText('>PM Code');

    const picks = await input.getQuickPicks();
    const labels = await Promise.all(picks.map((p) => p.getLabel()));
    assert.ok(
      labels.some((l) => l.includes('PM Code')),
      'PM Code commands should appear in command palette'
    );

    await input.cancel();
  });
});

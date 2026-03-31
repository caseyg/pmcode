import {
  ActivityBar,
  SideBarView,
  VSBrowser,
  Workbench,
} from 'vscode-extension-tester';

describe('PM Code Sidebar', () => {
  let browser: VSBrowser;

  before(async () => {
    browser = VSBrowser.instance;
  });

  it('should show PM Code activity bar icon', async function () {
    this.timeout(30000);
    const activityBar = new ActivityBar();
    const controls = await activityBar.getViewControls();
    const names = await Promise.all(controls.map((c) => c.getTitle()));
    expect(names).to.include('PM Code');
  });

  it('should open sidebar when clicking activity bar icon', async function () {
    this.timeout(30000);
    const activityBar = new ActivityBar();
    const control = await activityBar.getViewControl('PM Code');
    expect(control).to.not.be.undefined;
    await control!.openView();

    const sideBar = new SideBarView();
    const title = await sideBar.getTitlePart().getTitle();
    expect(title).to.include('PM Code');
  });
});

describe('PM Code Commands', () => {
  it('should open command palette and find PM Code commands', async function () {
    this.timeout(30000);
    const workbench = new Workbench();
    const input = await workbench.openCommandPrompt();
    await input.setText('>PM Code');

    // Verify PM Code commands appear in the command palette
    const picks = await input.getQuickPicks();
    const labels = await Promise.all(picks.map((p) => p.getLabel()));
    expect(labels.some((l) => l.includes('PM Code'))).to.be.true;

    await input.cancel();
  });
});

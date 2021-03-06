import { Tree } from '@angular-devkit/schematics';
import {
  supportedPlatforms,
  setTest,
  jsonParse,
  getRootTsConfigPath,
} from '@nstudio/xplat-utils';
import { XplatHelpers } from '@nstudio/xplat';
import { createEmptyWorkspace, getFileContent } from '@nstudio/xplat/testing';
import { runSchematic } from '../../utils/testing';
setTest();

describe('xplat ionic angular', () => {
  let appTree: Tree;
  const defaultOptions: XplatHelpers.Schema = {
    npmScope: 'testing',
    prefix: 'ft', // foo test
    platforms: 'ionic',
  };

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree, 'angular');
  });

  xit('should create default xplat support for ionic which should always include web as well', async () => {
    const options: XplatHelpers.Schema = { ...defaultOptions };

    const tree = await runSchematic('xplat', options, appTree);
    const files = tree.files;
    expect(files.indexOf('/xplat/web/index.ts')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('/xplat/ionic/index.ts')).toBeGreaterThanOrEqual(0);
    expect(
      files.indexOf('/xplat/nativescript/index.ts')
    ).toBeGreaterThanOrEqual(-1);
    const packagePath = '/package.json';
    const packageFile = jsonParse(getFileContent(tree, packagePath));
    // const hasScss = packageFile.dependencies[`@testing/scss`];
    // expect(hasScss).not.toBeUndefined();
    const hasWebScss = packageFile.dependencies[`@testing/web-scss`];
    expect(hasWebScss).not.toBeUndefined();
    // should not include these root packages
    const hasNativeScript = packageFile.dependencies[`nativescript-angular`];
    expect(hasNativeScript).toBeUndefined();
    let filePath = getRootTsConfigPath();
    let fileContent = jsonParse(getFileContent(tree, filePath));
    // console.log(fileContent);
    expect(fileContent.compilerOptions.paths['@testing/ionic']).toBeTruthy();
    expect(fileContent.compilerOptions.paths['@testing/ionic/*']).toBeTruthy();
    filePath = '/xplat/ionic/.xplatframework';
    fileContent = getFileContent(tree, filePath);
    // console.log(fileContent);
    expect(fileContent.indexOf('angular')).toBeGreaterThanOrEqual(0);
  });

  it('should create default xplat support with framework suffix when not specifying default', async () => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    const options: XplatHelpers.Schema = { ...defaultOptions };

    const tree = await runSchematic('xplat', options, appTree);
    expect(tree.exists('/xplat/ionic-angular/index.ts')).toBeTruthy();
    const filePath = getRootTsConfigPath();
    const fileContent = jsonParse(getFileContent(tree, filePath));
    // console.log(fileContent);
    expect(
      fileContent.compilerOptions.paths['@testing/ionic-angular']
    ).toBeTruthy();
    expect(
      fileContent.compilerOptions.paths['@testing/ionic-angular/*']
    ).toBeTruthy();
  });

  it('when default framework is set, can still create base platform support', async () => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    let options: XplatHelpers.Schema = { ...defaultOptions };
    options.framework = 'angular';

    let tree = await runSchematic('xplat', options, appTree);
    expect(tree.exists('/xplat/ionic/index.ts')).toBeTruthy();
    let filePath = getRootTsConfigPath();
    let fileContent = jsonParse(getFileContent(tree, filePath));
    // console.log(fileContent);
    expect(fileContent.compilerOptions.paths['@testing/ionic']).toBeTruthy();
    expect(fileContent.compilerOptions.paths['@testing/ionic/*']).toBeTruthy();

    await expect(runSchematic('xplat', defaultOptions, tree)).rejects.toThrow(
      `You currently have "angular" set as your default frontend framework and have already generated xplat support for "ionic". A command is coming soon to auto reconfigure your workspace to later add baseline platform support for those which have previously been generated prepaired with a frontend framework.`
    );
  });
});

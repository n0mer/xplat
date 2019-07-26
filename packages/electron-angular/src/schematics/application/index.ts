import {
  chain,
  Tree,
  SchematicContext,
  SchematicsException,
  branchAndMerge,
  Rule,
  mergeWith,
  apply,
  url,
  template,
  move,
  noop,
  externalSchematic
} from '@angular-devkit/schematics';
import { formatFiles } from '@nrwl/workspace';
import {
  prerun,
  getPrefix,
  getNpmScope,
  stringUtils,
  updateAngularProjects,
  updateNxProjects,
  getJsonFromFile,
  updatePackageScripts,
  getGroupByName,
  getAppName,
  missingArgument,
  getDefaultTemplateOptions,
  XplatHelpers
} from '@nstudio/xplat';
import { XplatElectronAngularHelpers } from '../../utils';
import {
  NodePackageInstallTask,
  RunSchematicTask
} from '@angular-devkit/schematics/tasks';
import { XplatElectrontHelpers } from '@nstudio/electron';

export default function(options: XplatElectrontHelpers.SchemaApp) {
  if (!options.name) {
    throw new SchematicsException(
      missingArgument(
        'name',
        'Provide a name for your Electron app.',
        'ng g @nstudio/electron-angular:app name'
      )
    );
  }
  if (!options.target) {
    throw new SchematicsException(
      missingArgument(
        'target',
        'Provide the name of the web app in your workspace to use inside the electron app.',
        'ng g @nstudio/electron-angular:app name --target web-myapp'
      )
    );
  }

  const packageHandling = [];
  if (options.isTesting) {
    packageHandling.push(
      externalSchematic('@nstudio/electron', 'tools', {
        ...options
      })
    );
  } else {
    // TODO: find a way to unit test schematictask runners with install tasks
    packageHandling.push((tree: Tree, context: SchematicContext) => {
      const installPackageTask = context.addTask(new NodePackageInstallTask());

      // console.log('packagesToRunXplat:', packagesToRunXplat);
      context.addTask(
        new RunSchematicTask('@nstudio/electron', 'tools', options),
        [installPackageTask]
      );
    });
  }

  return chain([
    prerun(options),
    // adjust naming convention
    XplatHelpers.applyAppNamingConvention(options, 'electron'),
    (tree: Tree, context: SchematicContext) =>
      externalSchematic('@nstudio/electron', 'xplat', {
        ...options,
        skipDependentPlatformFiles: true
      }),
    // create app files
    (tree: Tree, context: SchematicContext) =>
      addAppFiles(options, options.name)(tree, context),
    // add root package dependencies
    XplatElectronAngularHelpers.updateRootDeps(options),
    ...packageHandling,
    // add root package dependencies
    // add npm scripts
    XplatElectrontHelpers.addNpmScripts(options),
    // angular.json
    (tree: Tree) => {
      // grab the target app configuration
      const ngConfig = getJsonFromFile(tree, 'angular.json');
      // find app
      const fullTargetAppName = options.target;
      let targetConfig;
      if (ngConfig && ngConfig.projects) {
        targetConfig = ngConfig.projects[fullTargetAppName];
      }
      if (!targetConfig) {
        throw new SchematicsException(
          `The target app name "${fullTargetAppName}" does not appear to be in your workspace angular.json. You may need to generate it first or perhaps check the spelling.`
        );
      }

      const projects = {};
      const electronAppName = options.name;
      projects[electronAppName] = targetConfig;
      // update to use electron module
      projects[
        electronAppName
      ].architect.build.options.outputPath = `dist/apps/${electronAppName}`;

      if (!options.skipXplat) {
        projects[
          electronAppName
        ].architect.build.options.main = `apps/${fullTargetAppName}/src/main.electron.ts`;
      }
      projects[electronAppName].architect.build.options.assets.push({
        glob: '**/*',
        input: `apps/${electronAppName}/src/`,
        ignore: ['**/*.ts'],
        output: ''
      });
      projects[
        electronAppName
      ].architect.serve.options.browserTarget = `${electronAppName}:build`;
      projects[
        electronAppName
      ].architect.serve.configurations.production.browserTarget = `${electronAppName}:build:production`;
      // clear other settings (TODO: may need these in future), for now keep electron options minimal
      delete projects[electronAppName].architect['extract-i18n'];
      delete projects[electronAppName].architect['test'];
      delete projects[electronAppName].architect['lint'];
      return updateAngularProjects(tree, projects);
    },
    // nx.json
    (tree: Tree) => {
      const projects = {};
      projects[`${options.name}`] = {
        tags: []
      };
      return updateNxProjects(tree, projects);
    },
    options.skipXplat
      ? noop()
      : // adjust app files
        (tree: Tree) => adjustAppFiles(options, tree),

    formatFiles({ skipFormat: options.skipFormat })
  ]);
}

function addAppFiles(
  options: XplatElectrontHelpers.SchemaApp,
  appPath: string
): Rule {
  const appname = getAppName(options, 'electron');
  const directory = options.directory ? `${options.directory}/` : '';
  return branchAndMerge(
    mergeWith(
      apply(url(`./_files`), [
        template({
          ...(options as any),
          ...getDefaultTemplateOptions(),
          appname,
          xplatFolderName: XplatHelpers.getXplatFoldername(
            'electron',
            'angular'
          )
        }),
        move(`apps/${directory}${appPath}`)
      ])
    )
  );
}

function adjustAppFiles(options: XplatElectrontHelpers.SchemaApp, tree: Tree) {
  const fullTargetAppName = options.target;
  const electronModulePath = `/apps/${fullTargetAppName}/src/app/app.electron.module.ts`;
  if (!tree.exists(electronModulePath)) {
    tree.create(electronModulePath, electronModule());
  }
  const electronMainPath = `/apps/${fullTargetAppName}/src/main.electron.ts`;
  if (!tree.exists(electronMainPath)) {
    tree.create(electronMainPath, electronMain());
  }
  return tree;
}

function electronModule() {
  return `import { NgModule } from '@angular/core';
import { ${stringUtils.classify(
    getPrefix()
  )}ElectronCoreModule } from '@${getNpmScope()}/${XplatHelpers.getXplatFoldername(
    'electron',
    'angular'
  )}';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';

@NgModule({
  imports: [AppModule, ${stringUtils.classify(getPrefix())}ElectronCoreModule],
  bootstrap: [AppComponent]
})
export class AppElectronModule {}`;
}

function electronMain() {
  return `import { enableProdMode } from '@angular/core';
  import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
  
  // libs
  import { environment } from '@${getNpmScope()}/core';
  
  // app
  import { AppElectronModule } from './app/app.electron.module';
  
  if (environment.production) {
    enableProdMode();
  }
  
  platformBrowserDynamic()
    .bootstrapModule(AppElectronModule)
    .catch(err => console.log(err));
  `;
}
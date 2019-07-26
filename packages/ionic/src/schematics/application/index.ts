import {
  XplatHelpers,
  prerun,
  missingArgument,
  getAppName,
  getDefaultTemplateOptions,
  getPrefix,
  updateAngularProjects,
  updateNxProjects,
  updatePackageScripts
} from '@nstudio/xplat';
import {
  chain,
  noop,
  Tree,
  SchematicContext,
  SchematicsException,
  branchAndMerge,
  mergeWith,
  apply,
  url,
  template,
  move
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { XplatIonicHelpers } from '../../utils';
import { formatFiles } from '@nrwl/workspace';

export default function(options: Schema) {
  if (!options.name) {
    throw new SchematicsException(
      missingArgument(
        'name',
        'Provide a name for your Ionic app.',
        'ng g @nstudio/ionic:app name'
      )
    );
  }

  return chain([
    prerun(options),
    // adjust naming convention
    XplatHelpers.applyAppNamingConvention(options, 'ionic'),
    // create app files
    (tree: Tree, context: SchematicContext) =>
      addAppFiles(options, options.name)(tree, context),
    // add root package dependencies
    XplatIonicHelpers.updateRootDeps(options),
    XplatHelpers.addPackageInstallTask(options),
    // add start/clean scripts
    (tree: Tree) => {
      const scripts = {};
      const platformApp = options.name.replace('-', '.');
      const directory = options.directory ? `${options.directory}/` : '';
      // ensure convenient clean script is added for workspace
      scripts[
        `clean`
      ] = `npx rimraf -- hooks node_modules package-lock.json && npm i`;
      scripts[`start.${platformApp}`] = `cd apps/${directory}${
        options.name
      } && npm start`;
      return updatePackageScripts(tree, scripts);
    },
    (tree: Tree) => {
      const directory = options.directory ? `${options.directory}/` : '';
      const projects = {};
      projects[`${options.name}`] = {
        root: `apps/${directory}${options.name}/`,
        sourceRoot: `apps/${directory}${options.name}/src`,
        projectType: 'application',
        prefix: getPrefix()
      };
      return updateAngularProjects(tree, projects);
    },
    (tree: Tree) => {
      const projects = {};
      projects[`${options.name}`] = {
        tags: []
      };
      return updateNxProjects(tree, projects);
    },
    formatFiles({ skipFormat: options.skipFormat })
  ]);
}

function addAppFiles(options: Schema, appPath: string) {
  const appname = getAppName(options, 'ionic');
  const directory = options.directory ? `${options.directory}/` : '';
  return branchAndMerge(
    mergeWith(
      apply(url(`./_files`), [
        template({
          ...(options as any),
          ...getDefaultTemplateOptions(),
          appname,
          xplatFolderName: XplatHelpers.getXplatFoldername('ionic')
        }),
        move(`apps/${directory}${appPath}`)
      ])
    )
  );
}
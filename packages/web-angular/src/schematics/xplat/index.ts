import {
  chain,
  externalSchematic,
  noop,
  Tree,
  SchematicContext,
  branchAndMerge,
  mergeWith,
  apply,
  url,
  template,
  move,
} from '@angular-devkit/schematics';
import { XplatAngularHelpers } from '@nstudio/angular';
import { XplatHelpers, getDefaultTemplateOptions } from '@nstudio/xplat';
import { prerun } from '@nstudio/xplat-utils';
import { XplatWebAngularHelpers } from '../../utils/xplat';

export default function (options: XplatHelpers.Schema) {
  return chain([
    prerun(options, true),
    // (tree: Tree, context: SchematicContext) => {
    //   if (tree.exists(`/libs/xplat/core/src/lib/index.ts`)) {
    //     return noop();
    //   } else {
    //     return externalSchematic('@nstudio/angular', 'xplat', options, {
    //       interactive: false,
    //     })(tree, context);
    //   }
    // },
    XplatHelpers.generateLib(options, 'core', 'xplat/web', 'jsdom'),
    XplatHelpers.cleanupLib(options, 'core', 'xplat/web'),
    XplatHelpers.generateLib(options, 'features', 'xplat/web', 'jsdom'),
    XplatHelpers.cleanupLib(options, 'features', 'xplat/web'),
    XplatHelpers.generateLib(options, 'scss', 'xplat/web', 'jsdom'),
    XplatHelpers.cleanupLib(options, 'scss', 'xplat/web'),
    (tree: Tree, context: SchematicContext) => {
      const xplatFolderName = XplatHelpers.getXplatFoldername('web', 'angular');
      // console.log('xplatName:', xplatName);
      return options.skipDependentPlatformFiles
        ? noop()
        : XplatHelpers.addPlatformFiles(
            options,
            xplatFolderName,
            'core'
          )(tree, context);
    },
    (tree: Tree, context: SchematicContext) => {
      const xplatFolderName = XplatHelpers.getXplatFoldername('web', 'angular');
      // console.log('xplatName:', xplatName);
      return options.skipDependentPlatformFiles
        ? noop()
        : XplatHelpers.addPlatformFiles(
            options,
            xplatFolderName,
            'features'
          )(tree, context);
    },
    (tree: Tree, context: SchematicContext) => {
      const xplatFolderName = XplatHelpers.getXplatFoldername('web', 'angular');
      if (tree.exists(`/libs/xplat/${xplatFolderName}/scss/src/_index.scss`)) {
        // may have already generated web support
        return noop()(tree, context);
      } else {
        return branchAndMerge(
          mergeWith(
            apply(url(`./_files_platform_scss`), [
              template({
                ...(options as any),
                ...getDefaultTemplateOptions(),
              }),
              move(`libs/xplat/${xplatFolderName}/scss/src`),
            ])
          )
        )(tree, context);
      }
    },
    (tree: Tree, context: SchematicContext) => {
      if (tree.exists('/libs/xplat/scss/src/_index.scss')) {
        // user may have generated support already
        return noop()(tree, context);
      } else {
        return branchAndMerge(
          mergeWith(
            apply(url(`./_files_lib_scss`), [
              template({
                ...(options as any),
                ...getDefaultTemplateOptions(),
              }),
              move('libs/xplat/scss/src'),
            ])
          )
        )(tree, context);
      }
    },
    XplatWebAngularHelpers.updateRootDeps(options),
  ]);
}

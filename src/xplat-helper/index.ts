import {
  apply,
  chain,
  Tree,
  Rule,
  url,
  move,
  template,
  mergeWith,
  branchAndMerge,
  SchematicContext,
  SchematicsException,
  schematic,
  noop
} from "@angular-devkit/schematics";
import {
  stringUtils,
  prerun,
  getNpmScope,
  getPrefix,
  addRootDeps,
  updatePackageScripts,
  updateAngularProjects,
  updateNxProjects,
  applyAppNamingConvention,
  getGroupByName,
  getAppName,
  ITargetPlatforms,
  PlatformTypes,
  supportedPlatforms,
  unsupportedPlatformError,
  supportedHelpers,
  unsupportedHelperError,
  updateTsConfig,
  helperTargetError
} from "../utils";
import { Schema as HelperOptions } from "./schema";
// Helpers
import { supportApplitools_Web, applitools_logNote } from "./applitools";
import { supportImports_NativeScript } from "./imports";

// Configuration options for each helper
interface ISupportConfig {
  platforms: Array<string>;
  requiresTarget?: boolean;
  moveTo?: (platform: PlatformTypes, target?: string) => string;
  additionalSupport?: (
    platform: PlatformTypes,
    helperChains: Array<any>,
    options: HelperOptions
  ) => (tree: Tree, context: SchematicContext) => void;
}
interface IHelperSupportConfig {
  imports: ISupportConfig;
  applitools: ISupportConfig;
}
// Mapping config of what each helper supports
const helperSupportConfig: IHelperSupportConfig = {
  imports: {
    platforms: ["nativescript"],
    moveTo: function(platform: PlatformTypes, target?: string) {
      return `xplat/${platform}/utils`;
    },
    additionalSupport: function(
      platform: PlatformTypes,
      helperChains: Array<any>,
      options: HelperOptions
    ) {
      switch (platform) {
        case "nativescript":
          return supportImports_NativeScript(helperChains, options);
      }
    }
  },
  applitools: {
    platforms: ["web"],
    requiresTarget: true,
    additionalSupport: function(
      platform: PlatformTypes,
      helperChains: Array<any>,
      options: HelperOptions
    ) {
      switch (platform) {
        case "web":
          return supportApplitools_Web(helperChains, options);
      }
    }
  }
};
let helpers: Array<string> = [];
let platforms: Array<PlatformTypes> = [];
export default function(options: HelperOptions) {
  if (!options.name) {
    throw new SchematicsException(
      `Missing name argument. Provide a comma delimited list of helpers to generate. Example: ng g xplat-helper imports`
    );
  }
  helpers = options.name.split(",");
  platforms = <Array<PlatformTypes>>(
    (options.platforms ? options.platforms.split(",") : [])
  );

  if (platforms.length === 0) {
    throw new SchematicsException(
      `Missing platforms argument. Example: ng g xplat-helper imports --platforms=nativescript`
    );
  }

  const helperChains = [];

  for (const platform of platforms) {
    if (supportedPlatforms.includes(platform)) {
      for (const helper of helpers) {
        if (supportedHelpers.includes(helper)) {
          // get helper support config
          const supportConfig: ISupportConfig = helperSupportConfig[helper];
          if (supportConfig.platforms.includes(platform)) {
            if (supportConfig.moveTo) {
              if (supportConfig.requiresTarget && !options.target) {
                throw new SchematicsException(helperTargetError(helper));
              }

              // add files for the helper
              const moveTo = supportConfig.moveTo(platform, options.target);
              helperChains.push((tree: Tree, context: SchematicContext) => {
                return addHelperFiles(options, platform, helper, moveTo)(
                  tree,
                  context
                );
              });
            }

            if (supportConfig.additionalSupport) {
              // process additional support modifications
              helperChains.push((tree: Tree, context: SchematicContext) => {
                return supportConfig.additionalSupport(
                  platform,
                  helperChains,
                  options
                )(tree, context);
              });
            }
          }
        } else {
          throw new SchematicsException(unsupportedHelperError(helper));
        }
      }
    } else {
      throw new SchematicsException(unsupportedPlatformError(platform));
    }
  }

  return chain([
    prerun(options),
    // add helper chains
    ...helperChains,
    // log additional notes
    (tree: Tree) => {
      logNotes(options, helpers);
      return noop();
    }
  ]);
}

function addHelperFiles(
  options: HelperOptions,
  platform: PlatformTypes,
  helper: string,
  moveTo: string
): Rule {
  return branchAndMerge(
    mergeWith(
      apply(url(`./${helper}/${platform}/_files`), [
        template({
          ...(options as any),
          utils: stringUtils,
          npmScope: getNpmScope(),
          prefix: getPrefix(),
          dot: "."
        }),
        move(moveTo)
      ])
    )
  );
}

function logNotes(options: HelperOptions, helpers: string[]) {
  for (const helper of helpers) {
    switch (helper) {
      case "applitools":
        applitools_logNote(options);
        break;
    }
  }
}

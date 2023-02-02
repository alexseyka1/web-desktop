import { camelToKebabCase } from "../modules/Helper"

export const getDefinedApplications = () => {
  const apps = globalThis.definedApplications ?? {}
  return Object.entries(apps).reduce((response, [filename, module]) => {
    const manifests = globalThis?.definedManifests
    const info = manifests && filename in manifests ? manifests[filename] : {}

    const app = {
      module: module.default,
      info,
    }

    return {
      ...response,
      [camelToKebabCase(module.default.name) + ".app"]: app,
    }
  }, {})
}

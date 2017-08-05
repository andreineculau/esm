import FastObject from "../fast-object.js"
import Module from "module"
import URL from "url"

import builtinModules from "../builtin-modules.js"
import encodedSlash from "./encoded-slash.js"
import isPath from "./is-path.js"
import path from "path"
import toStringLiteral from "./to-string-literal.js"
import urlToPath from "./url-to-path.js"

const nodeModulePaths = Module._nodeModulePaths
const resolveFilename = Module._resolveFilename

const pathMode = process.platform === "win32" ? "win32" : "posix"
const resolveCache = new FastObject
const urlCharsRegExp = /[?#%]/

function resolveId(id, parent) {
  if (! id ||
      typeof id !== "string" ||
      id in builtinModules ||
      (! urlCharsRegExp.test(id) && isPath(id))) {
    return id
  }

  const filename = parent.filename === null ? "." : parent.filename
  const cacheKey = id + "\0" + filename

  if (cacheKey in resolveCache) {
    return resolveCache[cacheKey]
  }

  const parsed = URL.parse(id)

  if (! encodedSlash(parsed.pathname, pathMode)) {
    if (typeof parsed.protocol !== "string") {
      if (typeof parsed.pathname === "string") {
        id = decodeURI(parsed.pathname)
      }

      // Prevent resolving non-local dependencies:
      // https://github.com/bmeck/node-eps/blob/rewrite-esm/002-es-modules.md#432-removal-of-non-local-dependencies
      const paths = nodeModulePaths(path.dirname(filename))

      // Hack: Overwrite `path.concat()` to prevent global paths from being
      // concatenated.
      paths.concat = () => paths

      // Ensure a parent id and filename are provided to avoid going down the
      // --eval branch of `Module._resolveLookupPaths()`.
      return resolveCache[cacheKey] = resolveFilename(id, { filename, id: "<mock>", paths })
    }

    const filePath = urlToPath(parsed, pathMode)

    if (filePath) {
      return resolveCache[cacheKey] = resolveFilename(filePath, parent)
    }
  }

  const error = new Error("Module " + toStringLiteral(id, "'") + " not found")
  error.code = "MODULE_NOT_FOUND"
  throw error
}

export default resolveId

#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../src/cli.ts
import { createInterface as createInterface2 } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve as resolve3 } from "node:path";

// ../../src/config.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname as dirname2 } from "node:path";

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status2, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status2.dirty();
      arrayValue.push(s.value);
    }
    return { status: status2.value, value: arrayValue };
  }
  static async mergeObjectAsync(status2, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status2, syncPairs);
  }
  static mergeObjectSync(status2, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status2.dirty();
      if (value.status === "dirty")
        status2.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status2.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input2) {
    return getParsedType(input2.data);
  }
  _getOrReturnCtx(input2, ctx) {
    return ctx || {
      common: input2.parent.common,
      data: input2.data,
      parsedType: getParsedType(input2.data),
      schemaErrorMap: this._def.errorMap,
      path: input2.path,
      parent: input2.parent
    };
  }
  _processInputParams(input2) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input2.parent.common,
        data: input2.data,
        parsedType: getParsedType(input2.data),
        schemaErrorMap: this._def.errorMap,
        path: input2.path,
        parent: input2.parent
      }
    };
  }
  _parseSync(input2) {
    const result = this._parse(input2);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input2) {
    const result = this._parse(input2);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args2) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args2.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args2.precision}}`;
  } else if (args2.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args2.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args2) {
  return new RegExp(`^${timeRegexSource(args2)}$`);
}
function datetimeRegex(args2) {
  let regex = `${dateRegexSource}T${timeRegexSource(args2)}`;
  const opts = [];
  opts.push(args2.local ? `Z?` : `Z`);
  if (args2.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input2) {
    if (this._def.coerce) {
      input2.data = String(input2.data);
    }
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input2);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status2 = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input2.data.length < check.value) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "max") {
        if (input2.data.length > check.value) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input2.data.length > check.value;
        const tooSmall = input2.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input2, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status2.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input2.data);
        } catch {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input2.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "trim") {
        input2.data = input2.data.trim();
      } else if (check.kind === "includes") {
        if (!input2.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input2.data = input2.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input2.data = input2.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input2.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input2.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input2.data, check.version)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input2.data, check.alg)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input2.data, check.version)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status2.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status2.value, value: input2.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input2) {
    if (this._def.coerce) {
      input2.data = Number(input2.data);
    }
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input2);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status2 = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input2.data < check.value : input2.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input2.data > check.value : input2.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input2.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input2.data)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status2.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status2.value, value: input2.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input2) {
    if (this._def.coerce) {
      try {
        input2.data = BigInt(input2.data);
      } catch {
        return this._getInvalidInput(input2);
      }
    }
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input2);
    }
    let ctx = void 0;
    const status2 = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input2.data < check.value : input2.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input2.data > check.value : input2.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status2.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input2.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status2.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status2.value, value: input2.data };
  }
  _getInvalidInput(input2) {
    const ctx = this._getOrReturnCtx(input2);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input2) {
    if (this._def.coerce) {
      input2.data = Boolean(input2.data);
    }
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input2);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input2.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input2) {
    if (this._def.coerce) {
      input2.data = new Date(input2.data);
    }
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input2);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input2.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input2);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status2 = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input2.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status2.dirty();
        }
      } else if (check.kind === "max") {
        if (input2.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input2, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status2.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status2.value,
      value: new Date(input2.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input2);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input2.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input2);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input2.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input2);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input2.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input2) {
    return OK(input2.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input2) {
    return OK(input2.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input2) {
    const ctx = this._getOrReturnCtx(input2);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input2);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input2.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input2) {
    const { ctx, status: status2 } = this._processInputParams(input2);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status2.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status2.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status2.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status2, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status2, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input2);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status: status2, ctx } = this._processInputParams(input2);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status2.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status2, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status2, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input2) {
    const { status: status2, ctx } = this._processInputParams(input2);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status2.dirty();
      }
      return { status: status2.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input2) {
    const { status: status2, ctx } = this._processInputParams(input2);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status2.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status2, results);
      });
    } else {
      return ParseStatus.mergeArray(status2, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input2) {
    const { status: status2, ctx } = this._processInputParams(input2);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status2, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status2, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input2) {
    const { status: status2, ctx } = this._processInputParams(input2);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status2.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status2.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status2.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status2.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input2) {
    const { status: status2, ctx } = this._processInputParams(input2);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status2.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status2.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status2.dirty();
        parsedSet.add(element.value);
      }
      return { status: status2.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args2, error) {
      return makeIssue({
        data: args2,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args2) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args2, params).catch((e) => {
          error.addIssue(makeArgsIssue(args2, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args2) {
        const parsedArgs = me._def.args.safeParse(args2, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args2, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args2, returns, params) {
    return new _ZodFunction({
      args: args2 ? args2 : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input2) {
    if (input2.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input2);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input2.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input2) {
    if (typeof input2.data !== "string") {
      const ctx = this._getOrReturnCtx(input2);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input2.data)) {
      const ctx = this._getOrReturnCtx(input2);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input2.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input2) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input2);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input2.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input2.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input2) {
    const { status: status2, ctx } = this._processInputParams(input2);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status2.abort();
        } else {
          status2.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status2.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status2.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status2.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status2.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status2.dirty();
        executeRefinement(inner.value);
        return { status: status2.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status2.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status2.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status2.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status2.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input2);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input2);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input2) {
    const parsedType = this._getType(input2);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input2);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input2.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input2) {
    const { ctx } = this._processInputParams(input2);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input2) {
    const { status: status2, ctx } = this._processInputParams(input2);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status2.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status2.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input2) {
    const result = this._def.innerType._parse(input2);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../../src/protocol.ts
var RoleSchema = external_exports.enum(["outer", "worker", "reviewer", "utility"]);
var TransportSchema = external_exports.enum(["codex-cli", "claude-cli", "openai-api", "anthropic-api"]);
var RuntimeSchema = external_exports.enum(["auto", "cmux", "tmux", "process"]);
var ProfileSchema = external_exports.object({
  id: external_exports.string().min(1),
  role: RoleSchema,
  provider: external_exports.string().min(1),
  transport: TransportSchema,
  command: external_exports.string().min(1),
  model: external_exports.string().min(1).nullable().default(null),
  settings: external_exports.record(external_exports.string(), external_exports.unknown()).default({})
});
var TandemConfigSchema = external_exports.object({
  version: external_exports.literal(1),
  runtime: RuntimeSchema.default("auto"),
  profiles: external_exports.array(ProfileSchema).min(2),
  routing: external_exports.object({
    outer: external_exports.string().min(1),
    worker: external_exports.string().min(1),
    reviewer: external_exports.string().min(1).nullable().default(null)
  })
});
var GoalStatusSchema = external_exports.enum(["active", "complete", "blocked", "canceled"]);
var TaskStatusSchema = external_exports.enum([
  "queued",
  "preparing",
  "running",
  "blocked",
  "completed",
  "failed",
  "canceled"
]);
var WorkOrderSchema = external_exports.object({
  objective: external_exports.string().min(1),
  acceptanceCriteria: external_exports.array(external_exports.string().min(1)).default([]),
  context: external_exports.array(external_exports.string().min(1)).default([]),
  goalId: external_exports.string().nullable().default(null),
  parentTaskId: external_exports.string().nullable().default(null),
  profileId: external_exports.string().nullable().default(null)
});
var WorkerReportSchema = external_exports.object({
  status: external_exports.enum(["completed", "blocked", "failed"]),
  summary: external_exports.string().min(1),
  evidence: external_exports.array(external_exports.string()).default([]),
  tests: external_exports.array(external_exports.string()).default([]),
  blockers: external_exports.array(external_exports.string()).default([]),
  questions: external_exports.array(external_exports.string()).default([])
});

// ../../src/paths.ts
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
function tandemHome() {
  return resolve(process.env.TANDEM_HOME ?? join(homedir(), ".tandem"));
}
function packageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}
function configPath() {
  return join(tandemHome(), "config.json");
}
function databasePath() {
  return join(tandemHome(), "tandem.sqlite");
}
function logsDir() {
  return join(tandemHome(), "logs");
}
function worktreesDir() {
  return join(tandemHome(), "worktrees");
}

// ../../src/config.ts
var DEFAULT_CONFIG = {
  version: 1,
  runtime: "auto",
  profiles: [
    {
      id: "outer-primary",
      role: "outer",
      provider: "openai",
      transport: "codex-cli",
      command: "codex",
      model: null,
      settings: {
        search: true
      }
    },
    {
      id: "worker-primary",
      role: "worker",
      provider: "anthropic",
      transport: "claude-cli",
      command: "claude",
      model: null,
      settings: {
        permissionMode: "auto",
        effort: "high"
      }
    }
  ],
  routing: {
    outer: "outer-primary",
    worker: "worker-primary",
    reviewer: null
  }
};
async function loadConfig() {
  try {
    const raw = await readFile(configPath(), "utf8");
    return TandemConfigSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}
async function saveConfig(config) {
  const parsed = TandemConfigSchema.parse(config);
  const path = configPath();
  const temp = `${path}.tmp.${process.pid}`;
  await mkdir(dirname2(path), { recursive: true });
  await writeFile(temp, `${JSON.stringify(parsed, null, 2)}
`, { mode: 384 });
  await rename(temp, path);
}
function resolveProfile(config, id) {
  const profile = config.profiles.find((candidate) => candidate.id === id);
  if (!profile) {
    throw new Error(`Unknown profile: ${id}`);
  }
  return profile;
}
function outerProfile(config) {
  return resolveProfile(config, config.routing.outer);
}
function workerProfile(config, overrideId) {
  return resolveProfile(config, overrideId ?? config.routing.worker);
}

// ../../src/providers/claude-cli.ts
import { appendFile, mkdir as mkdir2 } from "node:fs/promises";
import { join as join3 } from "node:path";
import { spawn as spawn2 } from "node:child_process";
import { createInterface } from "node:readline";

// ../../src/process.ts
import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join as join2 } from "node:path";
import { spawn } from "node:child_process";
async function runCommand(command2, args2, options = {}) {
  return await new Promise((resolve4, reject) => {
    const child = spawn(command2, args2, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "pipe"
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs ?? 3e5);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`Command timed out: ${command2}`));
        return;
      }
      resolve4({ stdout, stderr, exitCode: code ?? 1 });
    });
    if (options.stdin !== void 0) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}
function findExecutable(command2, extraCandidates = []) {
  const candidates = [
    ...isAbsolute(command2) ? [command2] : (process.env.PATH ?? "").split(delimiter).filter(Boolean).map((directory) => join2(directory, command2)),
    ...extraCandidates
  ];
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return null;
}
function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
function sanitizeWorkerEnv(parent) {
  const exact = /* @__PURE__ */ new Set([
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "TZ",
    "TMPDIR",
    "TEMP",
    "TMP",
    "TERM",
    "PWD",
    "NODE_ENV",
    "SSH_AUTH_SOCK"
  ]);
  const prefixes = ["LC_", "TANDEM_", "CMUX_", "TMUX"];
  const result = {};
  for (const [key, value] of Object.entries(parent)) {
    if (value === void 0) continue;
    if (exact.has(key) || prefixes.some((prefix) => key.startsWith(prefix))) {
      result[key] = value;
    }
  }
  return result;
}
function truncate(value, max = 120) {
  const singleLine = value.replaceAll(/\s+/g, " ").trim();
  return singleLine.length <= max ? singleLine : `${singleLine.slice(0, max - 1)}\u2026`;
}

// ../../src/providers/claude-cli.ts
var REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "evidence", "tests", "blockers", "questions"],
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "failed"] },
    summary: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
    tests: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } }
  }
};
var ClaudeCliWorkerAdapter = class {
  transport = "claude-cli";
  child = null;
  async probe(profile) {
    if (!findExecutable(profile.command)) {
      throw new Error(`Claude CLI not found: ${profile.command}`);
    }
    return {
      toolCalling: true,
      structuredOutput: true,
      streaming: true,
      filesystemAgent: true,
      resumableSessions: true,
      usageReporting: true
    };
  }
  async run(profile, task, hooks) {
    const executable = findExecutable(profile.command);
    if (!executable) throw new Error(`Claude CLI not found: ${profile.command}`);
    await mkdir2(logsDir(), { recursive: true });
    const streamLog = join3(logsDir(), `${task.id}.claude.jsonl`);
    const permissionMode = stringSetting(profile, "permissionMode") ?? "auto";
    const effort = stringSetting(profile, "effort");
    const args2 = [
      "-p",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--json-schema",
      JSON.stringify(REPORT_JSON_SCHEMA),
      "--permission-mode",
      permissionMode,
      "--name",
      `tandem-${task.id.slice(0, 8)}`
    ];
    if (profile.model) args2.push("--model", profile.model);
    if (effort) args2.push("--effort", effort);
    const child = spawn2(executable, args2, {
      cwd: task.worktreePath,
      env: sanitizeWorkerEnv(process.env),
      stdio: "pipe"
    });
    this.child = child;
    child.stdin.write(streamingUserMessage(buildWorkerPrompt(task)));
    let resultEvent = null;
    let stderr = "";
    let writeTail = Promise.resolve();
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      process.stdout.write(`${line}
`);
      writeTail = writeTail.then(() => appendFile(streamLog, `${line}
`));
      const event = safeJsonObject(line);
      if (!event) return;
      if (event.type === "result") {
        resultEvent = event;
        child.stdin.end();
      }
      const activity = extractActivity(event);
      if (activity) hooks.onActivity("worker.activity", activity);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
      writeTail = writeTail.then(() => appendFile(streamLog, text));
    });
    const exitCode = await new Promise((resolve4, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve4(code ?? 1));
    });
    await writeTail;
    this.child = null;
    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `Claude exited with code ${exitCode}.`);
    }
    if (!isObject(resultEvent)) {
      throw new Error("Claude completed without a result event.");
    }
    const report = parseReport(resultEvent);
    return {
      report,
      sessionId: typeof resultEvent.session_id === "string" ? resultEvent.session_id : null,
      usage: isObject(resultEvent.usage) ? resultEvent.usage : null
    };
  }
  steer(message) {
    const text = message.trim();
    if (!text) throw new Error("Steering guidance cannot be empty.");
    if (!this.child || !this.child.stdin.writable) {
      throw new Error("The Claude worker is no longer accepting guidance.");
    }
    this.child.stdin.write(streamingUserMessage(text));
  }
  cancel() {
    this.child?.kill("SIGTERM");
  }
};
function streamingUserMessage(text) {
  return `${JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "text", text }]
    }
  })}
`;
}
function buildWorkerPrompt(task) {
  const acceptance = task.acceptanceCriteria.length > 0 ? task.acceptanceCriteria.map((item, index) => `${index + 1}. ${item}`).join("\n") : "No explicit criteria were supplied. Infer conservative, testable criteria from the objective.";
  const context = task.context.length > 0 ? task.context.map((item) => `- ${item}`).join("\n") : "- Inspect the repository and its local instructions.";
  return `You are Tandem's bounded execution worker.

Objective:
${task.objective}

Acceptance criteria:
${acceptance}

Context:
${context}

Operating contract:
- Work only inside the current Git worktree.
- Read and follow repository instructions such as AGENTS.md and CLAUDE.md.
- Implement the requested change, run proportionate verification, and leave all useful changes in the worktree.
- Do not create commits, branches, pull requests, or modify other worktrees; Tandem owns those lifecycle steps and will commit after your report.
- If the work order asks for a commit, interpret that as leaving the requested changes ready for Tandem to commit. Do not run git commit yourself.
- Do not broaden the objective. If a material product decision or missing authority blocks safe execution, stop and report status "blocked" with concise questions.
- Report concrete evidence and the exact tests or checks run.
- Your final response must satisfy the supplied JSON schema.`;
}
function parseReport(event) {
  const direct = WorkerReportSchema.safeParse(event.structured_output);
  if (direct.success) return direct.data;
  if (typeof event.result === "string") {
    try {
      return WorkerReportSchema.parse(JSON.parse(event.result));
    } catch {
    }
  }
  if (isObject(event.result)) {
    const nested = WorkerReportSchema.safeParse(event.result);
    if (nested.success) return nested.data;
  }
  throw new Error("Claude result did not contain a valid structured worker report.");
}
function extractActivity(event) {
  if (event.type !== "assistant" || !isObject(event.message)) return null;
  const content = event.message.content;
  if (!Array.isArray(content)) return null;
  const tool = content.find(
    (item) => isObject(item) && item.type === "tool_use" && typeof item.name === "string"
  );
  if (!isObject(tool) || typeof tool.name !== "string") return null;
  return {
    tool: tool.name,
    detail: describeToolUse(tool.name, tool.input)
  };
}
function describeToolUse(name, input2) {
  if (!isObject(input2)) return `Using ${name}`;
  const path = typeof input2.file_path === "string" ? input2.file_path : typeof input2.path === "string" ? input2.path : null;
  if (path) return `${name}: ${truncate(path, 90)}`;
  if (typeof input2.description === "string") return truncate(input2.description, 100);
  if (typeof input2.command === "string") return `${name}: ${truncate(input2.command, 90)}`;
  if (typeof input2.pattern === "string") return `${name}: ${truncate(input2.pattern, 90)}`;
  return `Using ${name}`;
}
function safeJsonObject(line) {
  try {
    const value = JSON.parse(line);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringSetting(profile, key) {
  const value = profile.settings[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ../../src/providers/codex-cli.ts
import { join as join4 } from "node:path";
import { spawn as spawn3 } from "node:child_process";
var MCP_ENV_VARS = [
  "TANDEM_HOME",
  "TANDEM_PROJECT_ROOT",
  "CMUX_WORKSPACE_ID",
  "CMUX_SURFACE_ID",
  "CMUX_SOCKET_PATH",
  "CMUX_SOCKET_PASSWORD"
];
var CodexCliOuterAdapter = class {
  transport = "codex-cli";
  async probe(profile) {
    if (!findExecutable(profile.command)) {
      throw new Error(`Codex CLI not found: ${profile.command}`);
    }
    return {
      toolCalling: true,
      structuredOutput: true,
      streaming: true,
      filesystemAgent: true,
      resumableSessions: true,
      usageReporting: true
    };
  }
  async launch(profile, projectRoot, prompt) {
    const executable = findExecutable(profile.command);
    if (!executable) throw new Error(`Codex CLI not found: ${profile.command}`);
    const mcpEntry = join4(packageRoot(), "dist", "mcp-server.js");
    const args2 = [
      "-C",
      projectRoot,
      "-c",
      `mcp_servers.tandem.command=${JSON.stringify(process.execPath)}`,
      "-c",
      `mcp_servers.tandem.args=${JSON.stringify([mcpEntry])}`,
      "-c",
      `mcp_servers.tandem.env_vars=${JSON.stringify(MCP_ENV_VARS)}`
    ];
    if (profile.model) args2.push("--model", profile.model);
    if (profile.settings.search === true) args2.push("--search");
    if (prompt) args2.push(prompt);
    const child = spawn3(executable, args2, {
      cwd: projectRoot,
      env: {
        ...process.env,
        TANDEM_HOME: tandemHome(),
        TANDEM_PROJECT_ROOT: projectRoot
      },
      stdio: "inherit"
    });
    return await new Promise((resolve4, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve4(code ?? 1));
    });
  }
};

// ../../src/providers/registry.ts
function createOuterAdapter(profile) {
  switch (profile.transport) {
    case "codex-cli":
      return new CodexCliOuterAdapter();
    default:
      throw new Error(`Outer transport is not implemented yet: ${profile.transport}`);
  }
}
function createWorkerAdapter(profile) {
  switch (profile.transport) {
    case "claude-cli":
      return new ClaudeCliWorkerAdapter();
    default:
      throw new Error(`Worker transport is not implemented yet: ${profile.transport}`);
  }
}

// ../../src/runtime.ts
import { closeSync, openSync } from "node:fs";
import { mkdir as mkdir3 } from "node:fs/promises";
import { join as join5 } from "node:path";
import { spawn as spawn4 } from "node:child_process";
var CMUX_CANDIDATES = [
  "/Applications/cmux.app/Contents/Resources/bin/cmux",
  "/Applications/cmux.app/Contents/MacOS/cmux"
];
function resolveCmuxBinary() {
  return findExecutable("cmux", CMUX_CANDIDATES);
}
async function selectRuntime(requested) {
  if (requested === "cmux" || requested === "auto") {
    const cmux = resolveCmuxBinary();
    if (cmux && process.env.CMUX_WORKSPACE_ID) {
      const ping = await runCommand(cmux, ["ping"], { timeoutMs: 5e3 });
      if (ping.exitCode === 0) return { runtime: "cmux", command: cmux };
      if (requested === "cmux") {
        throw new Error(`cmux is installed but Tandem cannot access its socket: ${ping.stderr}`);
      }
    } else if (requested === "cmux") {
      throw new Error(
        "cmux runtime requested, but Tandem is not running inside an authorized cmux terminal."
      );
    }
  }
  if (requested === "tmux" || requested === "auto") {
    const tmux = findExecutable("tmux");
    if (tmux) return { runtime: "tmux", command: tmux };
    if (requested === "tmux") throw new Error("tmux runtime requested, but tmux is not installed.");
  }
  return { runtime: "process", command: null };
}
async function launchWorker(task, requested) {
  const selected = await selectRuntime(requested);
  const runnerEntry = process.env.TANDEM_WORKER_ENTRY ?? join5(packageRoot(), "dist", "cli.js");
  const runnerArgs = [runnerEntry, "worker-run", task.id];
  const runnerEnv = {
    ...process.env,
    TANDEM_HOME: tandemHome()
  };
  const shellCommand = [
    "env",
    `TANDEM_HOME=${shellQuote(tandemHome())}`,
    shellQuote(process.execPath),
    ...runnerArgs.map(shellQuote)
  ].join(" ");
  if (selected.runtime === "cmux") {
    const result = await runCommand(
      selected.command,
      ["new-workspace", "--cwd", task.worktreePath, "--command", shellCommand],
      { env: runnerEnv, timeoutMs: 1e4 }
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || "cmux failed to launch the worker.");
    }
    return {
      runtime: "cmux",
      runtimeRef: result.stdout.trim() || `cmux:${task.id.slice(0, 8)}`
    };
  }
  if (selected.runtime === "tmux") {
    const shortId = task.id.slice(0, 8);
    const args2 = process.env.TMUX ? [
      "new-window",
      "-d",
      "-P",
      "-F",
      "#{window_id}",
      "-n",
      `tandem-${shortId}`,
      "-c",
      task.worktreePath,
      shellCommand
    ] : [
      "new-session",
      "-d",
      "-P",
      "-F",
      "#{session_name}",
      "-s",
      `tandem-${shortId}`,
      "-c",
      task.worktreePath,
      shellCommand
    ];
    const result = await runCommand(selected.command, args2, {
      env: runnerEnv,
      timeoutMs: 1e4
    });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || "tmux failed to launch the worker.");
    }
    return { runtime: "tmux", runtimeRef: result.stdout.trim() };
  }
  await mkdir3(logsDir(), { recursive: true });
  const logPath = join5(logsDir(), `${task.id}.runner.log`);
  const logFd = openSync(logPath, "a");
  const child = spawn4(process.execPath, runnerArgs, {
    cwd: task.worktreePath,
    env: runnerEnv,
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  closeSync(logFd);
  child.unref();
  return { runtime: "process", runtimeRef: String(child.pid ?? "") };
}

// ../../src/service.ts
import { randomBytes } from "node:crypto";

// ../../src/store.ts
import { mkdirSync } from "node:fs";
import { dirname as dirname3 } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
var TandemStore = class {
  db;
  constructor(path = databasePath()) {
    mkdirSync(dirname3(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }
  close() {
    this.db.close();
  }
  createGoal(objective, parentId = null) {
    const id = randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `INSERT INTO goals (id, parent_id, objective, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`
    ).run(id, parentId, objective, now, now);
    return this.getGoal(id);
  }
  getGoal(id) {
    const row = this.db.prepare("SELECT * FROM goals WHERE id = ?").get(id);
    return row ? mapGoal(row) : null;
  }
  listGoals(limit = 50) {
    const rows = this.db.prepare("SELECT * FROM goals ORDER BY created_at DESC LIMIT ?").all(limit);
    return rows.map(mapGoal);
  }
  updateGoalStatus(id, status2) {
    GoalStatusSchema.parse(status2);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare("UPDATE goals SET status = ?, updated_at = ? WHERE id = ?").run(status2, now, id);
    const goal = this.getGoal(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);
    return goal;
  }
  createTask(input2) {
    const id = randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `INSERT INTO tasks (
          id, goal_id, parent_task_id, profile_id, repo_root, worktree_path, branch,
          objective, acceptance_json, context_json, status, runtime, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`
    ).run(
      id,
      input2.workOrder.goalId,
      input2.workOrder.parentTaskId,
      input2.profileId,
      input2.repoRoot,
      input2.worktreePath,
      input2.branch,
      input2.workOrder.objective,
      JSON.stringify(input2.workOrder.acceptanceCriteria),
      JSON.stringify(input2.workOrder.context),
      input2.runtime,
      now,
      now
    );
    this.appendEvent(id, "task.queued", {
      objective: input2.workOrder.objective,
      profileId: input2.profileId
    });
    return this.getTask(id);
  }
  getTask(idOrPrefix) {
    const exact = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(idOrPrefix);
    if (exact) return mapTask(exact);
    const matches = this.db.prepare("SELECT * FROM tasks WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2").all(`${idOrPrefix}%`);
    if (matches.length > 1) {
      throw new Error(`Ambiguous task prefix: ${idOrPrefix}`);
    }
    return matches[0] ? mapTask(matches[0]) : null;
  }
  listTasks(options = {}) {
    const limit = options.limit ?? 50;
    const rows = options.status ? this.db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?").all(options.status, limit) : this.db.prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?").all(limit);
    return rows.map(mapTask);
  }
  updateTask(id, patch) {
    const columns = [];
    const values = [];
    const add = (column, value) => {
      columns.push(`${column} = ?`);
      values.push(value);
    };
    if (patch.status !== void 0) {
      TaskStatusSchema.parse(patch.status);
      add("status", patch.status);
    }
    if (patch.runtime !== void 0) add("runtime", patch.runtime);
    if (patch.runtimeRef !== void 0) add("runtime_ref", patch.runtimeRef);
    if (patch.pid !== void 0) add("pid", patch.pid);
    if (patch.providerSessionId !== void 0) {
      add("provider_session_id", patch.providerSessionId);
    }
    if (patch.commitSha !== void 0) add("commit_sha", patch.commitSha);
    if (patch.summary !== void 0) add("summary", patch.summary);
    if (patch.report !== void 0) {
      add("report_json", patch.report === null ? null : JSON.stringify(patch.report));
    }
    if (patch.error !== void 0) add("error", patch.error);
    if (columns.length === 0) {
      const existing = this.getTask(id);
      if (!existing) throw new Error(`Task not found: ${id}`);
      return existing;
    }
    add("updated_at", (/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    this.db.prepare(`UPDATE tasks SET ${columns.join(", ")} WHERE id = ?`).run(...values);
    const task = this.getTask(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return task;
  }
  appendEvent(taskId, type, payload = {}) {
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const result = this.db.prepare(
      `INSERT INTO task_events (task_id, type, payload_json, created_at)
         VALUES (?, ?, ?, ?)`
    ).run(taskId, type, JSON.stringify(payload), createdAt);
    return {
      id: Number(result.lastInsertRowid),
      taskId,
      type,
      payload,
      createdAt
    };
  }
  listEvents(taskId, afterId = 0) {
    const rows = this.db.prepare(
      `SELECT * FROM task_events
         WHERE task_id = ? AND id > ?
         ORDER BY id ASC`
    ).all(taskId, afterId);
    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      type: row.type,
      payload: JSON.parse(row.payload_json),
      createdAt: row.created_at
    }));
  }
  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES goals(id),
        objective TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        goal_id TEXT REFERENCES goals(id),
        parent_task_id TEXT REFERENCES tasks(id),
        profile_id TEXT NOT NULL,
        repo_root TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        branch TEXT NOT NULL,
        objective TEXT NOT NULL,
        acceptance_json TEXT NOT NULL,
        context_json TEXT NOT NULL,
        status TEXT NOT NULL,
        runtime TEXT NOT NULL,
        runtime_ref TEXT,
        pid INTEGER,
        provider_session_id TEXT,
        commit_sha TEXT,
        summary TEXT,
        report_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS task_events_task_id_idx
      ON task_events(task_id, id);
    `);
  }
};
function mapGoal(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    objective: row.objective,
    status: GoalStatusSchema.parse(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapTask(row) {
  return {
    id: row.id,
    goalId: row.goal_id,
    parentTaskId: row.parent_task_id,
    profileId: row.profile_id,
    repoRoot: row.repo_root,
    worktreePath: row.worktree_path,
    branch: row.branch,
    objective: row.objective,
    acceptanceCriteria: JSON.parse(row.acceptance_json),
    context: JSON.parse(row.context_json),
    status: TaskStatusSchema.parse(row.status),
    runtime: row.runtime,
    runtimeRef: row.runtime_ref,
    pid: row.pid,
    providerSessionId: row.provider_session_id,
    commitSha: row.commit_sha,
    summary: row.summary,
    report: row.report_json ? WorkerReportSchema.parse(JSON.parse(row.report_json)) : null,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ../../src/workspace.ts
import { createHash } from "node:crypto";
import { mkdir as mkdir4 } from "node:fs/promises";
import { basename, join as join6, resolve as resolve2 } from "node:path";
async function prepareWorktree(cwd, key) {
  const rootResult = await runCommand("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (rootResult.exitCode !== 0) {
    throw new Error("Tandem workers currently require a Git repository.");
  }
  const repoRoot = resolve2(rootResult.stdout.trim());
  const status2 = await runCommand("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (status2.exitCode !== 0) {
    throw new Error(status2.stderr || "Unable to inspect repository status.");
  }
  if (status2.stdout.trim()) {
    throw new Error(
      "The repository has uncommitted changes. Commit or stash them before delegating so the worker receives an exact, recoverable snapshot."
    );
  }
  const repoHash = createHash("sha256").update(repoRoot).digest("hex").slice(0, 12);
  const repoName = basename(repoRoot).replaceAll(/[^A-Za-z0-9._-]/g, "-");
  const parent = join6(worktreesDir(), `${repoName}-${repoHash}`);
  const path = join6(parent, key);
  const branch = `tandem/${key}`;
  await mkdir4(parent, { recursive: true });
  const add = await runCommand("git", ["worktree", "add", "-b", branch, path, "HEAD"], {
    cwd: repoRoot
  });
  if (add.exitCode !== 0) {
    throw new Error(add.stderr || add.stdout || "Failed to create worker worktree.");
  }
  return { repoRoot, path, branch };
}
async function commitWorktree(worktreePath, objective, repoRoot) {
  const status2 = await runCommand("git", ["status", "--porcelain"], { cwd: worktreePath });
  if (status2.exitCode !== 0) {
    throw new Error(status2.stderr || "Unable to inspect worker changes.");
  }
  if (!status2.stdout.trim()) {
    if (!repoRoot) return null;
    const baseHead = await runCommand("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
    if (baseHead.exitCode !== 0) {
      throw new Error(baseHead.stderr || "Unable to resolve the source repository HEAD.");
    }
    const workerCommit = await runCommand(
      "git",
      ["rev-list", "--max-count=1", "HEAD", "--not", baseHead.stdout.trim()],
      { cwd: worktreePath }
    );
    if (workerCommit.exitCode !== 0) {
      throw new Error(workerCommit.stderr || "Unable to inspect worker-created commits.");
    }
    return workerCommit.stdout.trim() || null;
  }
  const add = await runCommand("git", ["add", "-A"], { cwd: worktreePath });
  if (add.exitCode !== 0) {
    throw new Error(add.stderr || "Unable to stage worker changes.");
  }
  const subject = `tandem: ${truncate(objective, 60)}`;
  const commit = await runCommand(
    "git",
    ["-c", "user.name=Tandem Worker", "-c", "user.email=tandem@local", "commit", "-m", subject],
    { cwd: worktreePath }
  );
  if (commit.exitCode !== 0) {
    throw new Error(commit.stderr || commit.stdout || "Unable to commit worker changes.");
  }
  const sha = await runCommand("git", ["rev-parse", "HEAD"], { cwd: worktreePath });
  if (sha.exitCode !== 0) {
    throw new Error(sha.stderr || "Unable to resolve worker commit.");
  }
  return sha.stdout.trim();
}
async function applyTaskCommit(repoRoot, commitSha) {
  const status2 = await runCommand("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (status2.exitCode !== 0) throw new Error(status2.stderr || "Unable to inspect repository.");
  if (status2.stdout.trim()) {
    throw new Error("The target repository has uncommitted changes; refusing to cherry-pick.");
  }
  const result = await runCommand("git", ["cherry-pick", commitSha], { cwd: repoRoot });
  if (result.exitCode !== 0) {
    throw new Error(
      `${result.stderr || result.stdout || "Cherry-pick failed."}
Resolve or abort the cherry-pick with Git.`
    );
  }
}

// ../../src/service.ts
var TERMINAL_TASK_STATUSES = /* @__PURE__ */ new Set(["blocked", "completed", "failed", "canceled"]);
var TandemService = class {
  constructor(store = new TandemStore()) {
    this.store = store;
  }
  store;
  close() {
    this.store.close();
  }
  createGoal(objective, parentId = null) {
    if (parentId && !this.store.getGoal(parentId)) {
      throw new Error(`Parent goal not found: ${parentId}`);
    }
    return this.store.createGoal(objective, parentId);
  }
  listGoals(limit = 50) {
    return this.store.listGoals(limit);
  }
  async delegate(input2, projectRoot) {
    const workOrder = WorkOrderSchema.parse(input2);
    if (workOrder.goalId && !this.store.getGoal(workOrder.goalId)) {
      throw new Error(`Goal not found: ${workOrder.goalId}`);
    }
    if (workOrder.parentTaskId && !this.store.getTask(workOrder.parentTaskId)) {
      throw new Error(`Parent task not found: ${workOrder.parentTaskId}`);
    }
    const config = await loadConfig();
    const profile = workerProfile(config, workOrder.profileId);
    const key = buildTaskKey();
    const worktree = await prepareWorktree(projectRoot, key);
    let task = this.store.createTask({
      workOrder,
      profileId: profile.id,
      repoRoot: worktree.repoRoot,
      worktreePath: worktree.path,
      branch: worktree.branch,
      runtime: config.runtime
    });
    try {
      const launch = await launchWorker(task, config.runtime);
      task = this.store.updateTask(task.id, {
        runtime: launch.runtime,
        runtimeRef: launch.runtimeRef
      });
      this.store.appendEvent(task.id, "worker.launched", {
        runtime: launch.runtime,
        runtimeRef: launch.runtimeRef,
        worktreePath: task.worktreePath
      });
      return task;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.updateTask(task.id, { status: "failed", error: message });
      this.store.appendEvent(task.id, "worker.launch_failed", { error: message });
      throw error;
    }
  }
  getTask(id) {
    return this.store.getTask(id);
  }
  listTasks(options = {}) {
    const status2 = options.status === void 0 ? void 0 : TaskStatusSchema.parse(options.status);
    return this.store.listTasks({
      ...options.limit === void 0 ? {} : { limit: options.limit },
      ...status2 === void 0 ? {} : { status: status2 }
    });
  }
  events(taskId, afterId = 0) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return this.store.listEvents(task.id, afterId);
  }
  async waitForTask(taskId, afterEventId = 0, timeoutSeconds = 25) {
    const deadline = Date.now() + Math.min(Math.max(timeoutSeconds, 0), 30) * 1e3;
    while (true) {
      const task = this.store.getTask(taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      const events = this.store.listEvents(task.id, afterEventId);
      if (events.length > 0 || TERMINAL_TASK_STATUSES.has(task.status) || Date.now() >= deadline) {
        return { task, events };
      }
      await new Promise((resolve4) => setTimeout(resolve4, 300));
    }
  }
  cancelTask(taskId) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (TERMINAL_TASK_STATUSES.has(task.status)) return task;
    if (task.pid) {
      try {
        process.kill(task.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    const canceled = this.store.updateTask(task.id, { status: "canceled" });
    this.store.appendEvent(task.id, "task.canceled", { pid: task.pid });
    return canceled;
  }
  steerTask(taskId, message) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!["queued", "preparing", "running"].includes(task.status)) {
      throw new Error(`Task ${task.id.slice(0, 8)} is not accepting guidance.`);
    }
    const guidance = message.trim();
    if (!guidance) throw new Error("Steering guidance cannot be empty.");
    this.store.appendEvent(task.id, "task.steer.requested", { message: guidance });
    return task;
  }
  async applyTask(taskId) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== "completed") {
      throw new Error(`Only completed tasks can be applied; task status is ${task.status}.`);
    }
    if (!task.commitSha) {
      throw new Error("This task completed without creating a commit.");
    }
    await applyTaskCommit(task.repoRoot, task.commitSha);
    this.store.appendEvent(task.id, "task.applied", {
      commitSha: task.commitSha,
      repoRoot: task.repoRoot
    });
    return task;
  }
};
function buildTaskKey() {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
  return `${timestamp}-${randomBytes(3).toString("hex")}`;
}

// ../../src/worker.ts
async function runWorker(taskId) {
  const store = new TandemStore();
  const task = store.getTask(taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    store.close();
    return 1;
  }
  if (["completed", "failed", "canceled"].includes(task.status)) {
    store.close();
    return 0;
  }
  const config = await loadConfig();
  const profile = resolveProfile(config, task.profileId);
  const adapter = createWorkerAdapter(profile);
  let interrupted = false;
  let steerCursor = 0;
  let steeringBusy = false;
  const steeringInterval = setInterval(() => {
    if (steeringBusy || interrupted) return;
    steeringBusy = true;
    try {
      const events = store.listEvents(task.id, steerCursor);
      for (const event of events) {
        steerCursor = Math.max(steerCursor, event.id);
        if (event.type !== "task.steer.requested") continue;
        const message = event.payload.message;
        if (typeof message !== "string" || !message.trim()) continue;
        try {
          adapter.steer(message);
          store.appendEvent(task.id, "worker.steered", { message });
        } catch (error) {
          store.appendEvent(task.id, "worker.steer_failed", {
            message,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } finally {
      steeringBusy = false;
    }
  }, 250);
  const cancel = () => {
    if (interrupted) return;
    interrupted = true;
    adapter.cancel();
    try {
      const current = store.getTask(task.id);
      if (current && !["completed", "failed", "canceled"].includes(current.status)) {
        store.updateTask(task.id, { status: "canceled" });
        store.appendEvent(task.id, "worker.canceled", { signal: "SIGTERM" });
      }
    } finally {
      void updateCmux("canceled", 1);
    }
  };
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  try {
    store.updateTask(task.id, {
      status: "running",
      pid: process.pid,
      error: null
    });
    store.appendEvent(task.id, "worker.started", {
      pid: process.pid,
      provider: profile.provider,
      model: profile.model
    });
    await updateCmux("running", 0.15);
    const result = await adapter.run(profile, task, {
      onActivity: (type, payload = {}) => {
        store.appendEvent(task.id, type, payload);
      }
    });
    if (interrupted || store.getTask(task.id)?.status === "canceled") return 130;
    if (result.usage) {
      store.appendEvent(task.id, "worker.usage", result.usage);
    }
    if (result.report.status === "completed") {
      const commitSha = await commitWorktree(task.worktreePath, task.objective, task.repoRoot);
      store.updateTask(task.id, {
        status: "completed",
        providerSessionId: result.sessionId,
        commitSha,
        summary: result.report.summary,
        report: result.report
      });
      store.appendEvent(task.id, "worker.completed", {
        commitSha,
        summary: result.report.summary
      });
      await updateCmux("completed", 1);
      await notifyCmux("Tandem worker completed", task.objective);
      return 0;
    }
    const status2 = result.report.status === "blocked" ? "blocked" : "failed";
    store.updateTask(task.id, {
      status: status2,
      providerSessionId: result.sessionId,
      summary: result.report.summary,
      report: result.report,
      error: result.report.blockers.join("\n") || null
    });
    store.appendEvent(task.id, `worker.${status2}`, {
      summary: result.report.summary,
      blockers: result.report.blockers,
      questions: result.report.questions
    });
    await updateCmux(status2, 1);
    await notifyCmux(`Tandem worker ${status2}`, task.objective);
    return status2 === "blocked" ? 2 : 1;
  } catch (error) {
    if (interrupted) return 130;
    const message = error instanceof Error ? error.message : String(error);
    store.updateTask(task.id, { status: "failed", error: message });
    store.appendEvent(task.id, "worker.failed", { error: message });
    await updateCmux("failed", 1);
    await notifyCmux("Tandem worker failed", message);
    console.error(message);
    return 1;
  } finally {
    clearInterval(steeringInterval);
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
    store.close();
  }
}
async function updateCmux(status2, progress) {
  const cmux = resolveCmuxBinary();
  if (!cmux || !process.env.CMUX_WORKSPACE_ID) return;
  await runCommand(cmux, ["set-status", "tandem", status2, "--icon", "sparkles"], {
    timeoutMs: 3e3
  }).catch(() => void 0);
  await runCommand(cmux, ["set-progress", String(progress), "--label", `Tandem: ${status2}`], {
    timeoutMs: 3e3
  }).catch(() => void 0);
}
async function notifyCmux(title, body) {
  const cmux = resolveCmuxBinary();
  if (!cmux || !process.env.CMUX_WORKSPACE_ID) return;
  await runCommand(cmux, ["notify", "--title", title, "--body", body], {
    timeoutMs: 3e3
  }).catch(() => void 0);
}

// ../../src/cli.ts
var args = process.argv.slice(2);
var command = args.shift() ?? "help";
try {
  switch (command) {
    case "setup":
      await setup();
      break;
    case "doctor":
      await doctor();
      break;
    case "chat":
      await chat(args);
      break;
    case "status":
      await status();
      break;
    case "goal":
      await goalCommand(args);
      break;
    case "task":
      await taskCommand(args);
      break;
    case "apply":
      await applyCommand(args);
      break;
    case "worker-run":
      process.exitCode = await runWorker(requireArg(args, 0, "task id"));
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    case "version":
    case "--version":
    case "-v":
      console.log("tandem 0.1.0");
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`tandem: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
async function setup() {
  const existing = await loadConfig();
  const codex = findExecutable("codex");
  const claude = findExecutable("claude");
  const cmux = resolveCmuxBinary();
  const tmux = findExecutable("tmux");
  console.log("Tandem setup\n");
  console.log(`  Codex CLI   ${codex ?? "not found"}`);
  console.log(`  Claude CLI  ${claude ?? "not found"}`);
  console.log(`  cmux CLI    ${cmux ?? "not found"}`);
  console.log(`  tmux        ${tmux ?? "not found"}`);
  console.log();
  if (!codex || !claude) {
    throw new Error("Both Codex CLI and Claude CLI are required for the initial profile.");
  }
  let outerModel = outerProfile(existing).model ?? "";
  let workerModel = workerProfile(existing).model ?? "";
  const configuredPermissionMode = workerProfile(existing).settings.permissionMode;
  let permissionMode = typeof configuredPermissionMode === "string" ? configuredPermissionMode : "auto";
  let runtime = existing.runtime;
  if (input.isTTY && output.isTTY) {
    const rl = createInterface2({ input, output });
    try {
      outerModel = await ask(
        rl,
        "Outer Codex model (blank uses your Codex CLI default)",
        outerModel
      );
      workerModel = await ask(
        rl,
        "Claude worker model (blank uses your Claude CLI default; aliases are allowed)",
        workerModel
      );
      permissionMode = await ask(
        rl,
        "Claude permission mode (auto, acceptEdits, dontAsk, bypassPermissions)",
        permissionMode
      );
      const runtimeAnswer = await ask(rl, "Session runtime (auto, cmux, tmux, process)", runtime);
      if (!["auto", "cmux", "tmux", "process"].includes(runtimeAnswer)) {
        throw new Error(`Unsupported runtime: ${runtimeAnswer}`);
      }
      runtime = runtimeAnswer;
    } finally {
      rl.close();
    }
  }
  const config = {
    ...DEFAULT_CONFIG,
    runtime,
    profiles: DEFAULT_CONFIG.profiles.map((profile) => {
      if (profile.id === "outer-primary") {
        return { ...profile, model: outerModel || null };
      }
      return {
        ...profile,
        model: workerModel || null,
        settings: {
          ...profile.settings,
          permissionMode
        }
      };
    })
  };
  await saveConfig(config);
  console.log(`
Saved ${configPath()}`);
  console.log("Run `tandem doctor`, then `tandem chat` inside a clean Git repository.");
}
async function doctor() {
  const config = await loadConfig();
  const outer = outerProfile(config);
  const worker = workerProfile(config);
  const checks = [
    [
      "outer",
      async () => {
        await createOuterAdapter(outer).probe(outer);
        return `${outer.provider}/${outer.transport}${outer.model ? ` (${outer.model})` : ""}`;
      }
    ],
    [
      "worker",
      async () => {
        await createWorkerAdapter(worker).probe(worker);
        return `${worker.provider}/${worker.transport}${worker.model ? ` (${worker.model})` : ""}`;
      }
    ],
    [
      "runtime",
      async () => {
        const selected = await selectRuntime(config.runtime);
        return `${config.runtime} \u2192 ${selected.runtime}`;
      }
    ],
    [
      "git",
      async () => {
        const result = await runCommand("git", ["--version"]);
        if (result.exitCode !== 0) throw new Error(result.stderr);
        return result.stdout.trim();
      }
    ]
  ];
  console.log(`Tandem home: ${tandemHome()}
`);
  let failures = 0;
  for (const [name, check] of checks) {
    try {
      console.log(`\u2713 ${name.padEnd(8)} ${await check()}`);
    } catch (error) {
      failures += 1;
      console.log(`\u2717 ${name.padEnd(8)} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures > 0) process.exitCode = 1;
}
async function chat(rawArgs) {
  const config = await loadConfig();
  const profile = { ...outerProfile(config) };
  const cdIndex = rawArgs.indexOf("--cd");
  const modelIndex = rawArgs.indexOf("--model");
  const projectRoot = cdIndex >= 0 ? resolve3(requireArg(rawArgs, cdIndex + 1, "directory after --cd")) : process.cwd();
  if (modelIndex >= 0) {
    profile.model = requireArg(rawArgs, modelIndex + 1, "model after --model");
  }
  const consumed = /* @__PURE__ */ new Set();
  if (cdIndex >= 0) {
    consumed.add(cdIndex);
    consumed.add(cdIndex + 1);
  }
  if (modelIndex >= 0) {
    consumed.add(modelIndex);
    consumed.add(modelIndex + 1);
  }
  const prompt = rawArgs.filter((_, index) => !consumed.has(index)).join(" ").trim() || void 0;
  const adapter = createOuterAdapter(profile);
  process.exitCode = await adapter.launch(profile, projectRoot, prompt);
}
async function status() {
  const config = await loadConfig();
  const service = new TandemService();
  try {
    const tasks = service.listTasks({ limit: 20 });
    const active = tasks.filter((task) => ["queued", "preparing", "running"].includes(task.status));
    console.log(`Tandem home: ${tandemHome()}`);
    console.log(`Runtime:     ${config.runtime}`);
    console.log(
      `Outer:       ${formatProfile(outerProfile(config))}
Worker:      ${formatProfile(workerProfile(config))}`
    );
    console.log(`Tasks:       ${active.length} active, ${tasks.length} recent`);
    if (active.length > 0) {
      console.log();
      printTaskTable(active);
    }
  } finally {
    service.close();
  }
}
async function goalCommand(rawArgs) {
  const subcommand = rawArgs.shift() ?? "list";
  const service = new TandemService();
  try {
    if (subcommand === "list") {
      const goals = service.listGoals();
      if (goals.length === 0) {
        console.log("No goals.");
        return;
      }
      for (const goal of goals) {
        console.log(
          `${goal.id.slice(0, 8)}  ${goal.status.padEnd(9)}  ${truncate(goal.objective, 90)}`
        );
      }
      return;
    }
    if (subcommand === "create") {
      const objective = rawArgs.join(" ").trim();
      if (!objective) throw new Error("Usage: tandem goal create <objective>");
      const goal = service.createGoal(objective);
      console.log(JSON.stringify(goal, null, 2));
      return;
    }
    throw new Error(`Unknown goal command: ${subcommand}`);
  } finally {
    service.close();
  }
}
async function taskCommand(rawArgs) {
  const subcommand = rawArgs.shift() ?? "list";
  const service = new TandemService();
  try {
    if (subcommand === "list") {
      const statusIndex = rawArgs.indexOf("--status");
      const statusFilter = statusIndex >= 0 ? requireArg(rawArgs, statusIndex + 1, "status") : void 0;
      const tasks = service.listTasks({
        limit: 100,
        ...statusFilter ? { status: statusFilter } : {}
      });
      printTaskTable(tasks);
      return;
    }
    if (subcommand === "show") {
      const task = requireTask(service, requireArg(rawArgs, 0, "task id"));
      console.log(JSON.stringify({ task, events: service.events(task.id) }, null, 2));
      return;
    }
    if (subcommand === "watch") {
      await watchTask(service, requireArg(rawArgs, 0, "task id"), rawArgs.includes("--once"));
      return;
    }
    if (subcommand === "cancel") {
      console.log(JSON.stringify(service.cancelTask(requireArg(rawArgs, 0, "task id")), null, 2));
      return;
    }
    if (subcommand === "steer") {
      const id = requireArg(rawArgs, 0, "task id");
      const message = rawArgs.slice(1).join(" ").trim();
      if (!message) throw new Error("Usage: tandem task steer <task-id> <guidance>");
      console.log(JSON.stringify(service.steerTask(id, message), null, 2));
      return;
    }
    throw new Error(`Unknown task command: ${subcommand}`);
  } finally {
    service.close();
  }
}
async function applyCommand(rawArgs) {
  const id = requireArg(rawArgs, 0, "task id");
  const service = new TandemService();
  try {
    const task = await service.applyTask(id);
    console.log(`Applied ${task.commitSha} from task ${task.id.slice(0, 8)}.`);
  } finally {
    service.close();
  }
}
async function watchTask(service, id, once) {
  const terminal = /* @__PURE__ */ new Set(["blocked", "completed", "failed", "canceled"]);
  let after = 0;
  do {
    const result = await service.waitForTask(id, after, once ? 0 : 25);
    for (const event of result.events) {
      printEvent(event);
      after = Math.max(after, event.id);
    }
    if (terminal.has(result.task.status)) {
      console.log(`
${result.task.status}: ${result.task.summary ?? result.task.error ?? ""}`);
      if (result.task.commitSha) console.log(`commit: ${result.task.commitSha}`);
      return;
    }
    if (once) return;
  } while (true);
}
function printEvent(event) {
  const detail = typeof event.payload.summary === "string" ? event.payload.summary : typeof event.payload.tool === "string" ? event.payload.tool : "";
  console.log(`${event.createdAt}  ${event.type}${detail ? `  ${truncate(detail, 80)}` : ""}`);
}
function printTaskTable(tasks) {
  if (tasks.length === 0) {
    console.log("No tasks.");
    return;
  }
  for (const task of tasks) {
    console.log(
      `${task.id.slice(0, 8)}  ${task.status.padEnd(10)}  ${task.runtime.padEnd(7)}  ${truncate(task.objective, 82)}`
    );
  }
}
function requireTask(service, id) {
  const task = service.getTask(id);
  if (!task) throw new Error(`Task not found: ${id}`);
  return task;
}
function requireArg(values, index, label) {
  const value = values[index];
  if (!value) throw new Error(`Missing ${label}.`);
  return value;
}
async function ask(rl, label, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || defaultValue;
}
function formatProfile(profile) {
  return `${profile.provider}/${profile.transport}${profile.model ? `/${profile.model}` : " (CLI default model)"}`;
}
function printHelp() {
  console.log(`Tandem \u2014 provider-neutral outer-agent / worker orchestration

Usage:
  tandem setup
  tandem doctor
  tandem chat [--cd <repo>] [--model <model>] [initial prompt]
  tandem status
  tandem goal list
  tandem goal create <objective>
  tandem task list [--status <status>]
  tandem task show <task-id>
  tandem task watch <task-id> [--once]
  tandem task steer <task-id> <guidance>
  tandem task cancel <task-id>
  tandem apply <completed-task-id>

The initial profile uses Codex CLI for the outer conversation and Claude CLI
for execution workers. Workers run in isolated Git worktrees through cmux,
tmux, or a detached process, while SQLite remains the source of truth.`);
}

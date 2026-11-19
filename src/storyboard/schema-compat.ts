/**
 * Is a JSON Schema still a superset of an older one? Storyboard v1 is frozen
 * (roadmap L6): from 1.0 on, a storyboard that was valid stays valid, so the
 * schema may only grow. This compares the schema we publish with the frozen copy
 * and lists every change that would refuse a document the old one accepted.
 *
 * It covers the keywords the generated schema uses (draft-07 from Zod: type,
 * enum, const, properties, required, additionalProperties, items, anyOf, bounds,
 * pattern). A keyword it does not know is reported rather than ignored, so the
 * check can fail but never silently pass.
 */
type Json = unknown;
type Schema = { [key: string]: Json };

const IGNORED = new Set([
  "$schema",
  "$id",
  "title",
  "description",
  "default",
  "examples",
  "deprecated",
]);
const KNOWN = new Set([
  ...IGNORED,
  "type",
  "enum",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "anyOf",
  "oneOf",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
]);

const isSchema = (value: Json): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: Json): Json[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Changes in `next` that refuse something `old` accepted, each as a readable
 * path. An empty list means `next` accepts everything `old` did.
 */
export function breakingChanges(old: Json, next: Json, at = "$"): string[] {
  if (old === true || old === undefined)
    return next === false ? [`${at}: now accepts nothing`] : [];
  if (old === false) return [];
  if (next === true || next === undefined) return [];
  if (next === false) return [`${at}: now accepts nothing`];
  if (!isSchema(old) || !isSchema(next)) return [`${at}: not a schema`];

  for (const doc of [old, next])
    for (const key of Object.keys(doc))
      if (!KNOWN.has(key))
        return [`${at}: unsupported keyword "${key}", extend schema-compat.ts`];

  const out: string[] = [];

  // A union in the old schema: every branch must still be accepted by the new one.
  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = old[key];
    if (Array.isArray(branches)) {
      const rest = { ...old };
      delete rest[key];
      branches.forEach((branch, index) => {
        const merged = isSchema(branch) ? { ...rest, ...branch } : branch;
        out.push(...bestReasons(merged, next, `${at}.${key}[${index}]`));
      });
      return out;
    }
  }
  // A union only in the new schema: the old schema must fit inside one branch.
  const newBranches = asArray(next.anyOf ?? next.oneOf);
  if (newBranches.length) {
    const rest = { ...next };
    delete rest.anyOf;
    delete rest.oneOf;
    const fits = newBranches.some(
      (branch) =>
        breakingChanges(
          old,
          isSchema(branch) ? { ...rest, ...branch } : branch,
          at,
        ).length === 0,
    );
    return fits
      ? []
      : [`${at}: no branch of the new union accepts what the old schema did`];
  }

  // type
  if (old.type !== undefined) {
    const was = asArray(old.type);
    const now = asArray(next.type);
    if (next.type !== undefined) {
      const lost = was.filter(
        (t) => !now.includes(t) && !(t === "integer" && now.includes("number")),
      );
      if (lost.length)
        out.push(`${at}: type ${lost.join(", ")} is no longer accepted`);
    }
  } else if (next.type !== undefined) {
    out.push(`${at}: now restricted to type ${asArray(next.type).join(", ")}`);
  }

  // enum and const
  const allowedBefore =
    old.enum !== undefined
      ? asArray(old.enum)
      : old.const !== undefined
        ? [old.const]
        : undefined;
  const allowedNow =
    next.enum !== undefined
      ? asArray(next.enum)
      : next.const !== undefined
        ? [next.const]
        : undefined;
  if (allowedNow !== undefined) {
    if (allowedBefore === undefined)
      out.push(`${at}: now limited to a fixed set of values`);
    else
      for (const value of allowedBefore)
        if (!allowedNow.some((v) => same(v, value)))
          out.push(
            `${at}: value ${JSON.stringify(value)} is no longer accepted`,
          );
  }

  // numbers, strings, arrays
  const lower = (key: string, label: string) => {
    const a = old[key] as number | undefined;
    const b = next[key] as number | undefined;
    if (b !== undefined && (a === undefined || b > a))
      out.push(
        `${at}: ${label} raised ${a === undefined ? "from none" : `from ${a}`} to ${b}`,
      );
  };
  const upper = (key: string, label: string) => {
    const a = old[key] as number | undefined;
    const b = next[key] as number | undefined;
    if (b !== undefined && (a === undefined || b < a))
      out.push(
        `${at}: ${label} lowered ${a === undefined ? "from none" : `from ${a}`} to ${b}`,
      );
  };
  lower("minimum", "minimum");
  lower("exclusiveMinimum", "exclusive minimum");
  lower("minLength", "minimum length");
  lower("minItems", "minimum item count");
  upper("maximum", "maximum");
  upper("exclusiveMaximum", "exclusive maximum");
  upper("maxLength", "maximum length");
  upper("maxItems", "maximum item count");
  if (next.pattern !== undefined && next.pattern !== old.pattern)
    out.push(
      `${at}: pattern ${old.pattern === undefined ? "added" : "changed"}`,
    );
  if (next.format !== undefined && next.format !== old.format)
    out.push(`${at}: format ${old.format === undefined ? "added" : "changed"}`);

  // objects
  const oldProps = isSchema(old.properties) ? old.properties : {};
  const nextProps = isSchema(next.properties) ? next.properties : {};
  const oldRequired = asArray(old.required) as string[];
  const nextRequired = asArray(next.required) as string[];
  for (const name of nextRequired)
    if (!oldRequired.includes(name)) out.push(`${at}.${name}: is now required`);
  const closedNow = next.additionalProperties === false;
  const closedBefore = old.additionalProperties === false;
  if (closedNow && !closedBefore && old.type === "object")
    out.push(`${at}: unknown properties are now refused`);
  for (const [name, schema] of Object.entries(oldProps)) {
    if (!(name in nextProps)) {
      if (closedNow) out.push(`${at}.${name}: property was removed`);
      continue;
    }
    out.push(...breakingChanges(schema, nextProps[name], `${at}.${name}`));
  }
  if (isSchema(old.additionalProperties) || isSchema(next.additionalProperties))
    out.push(
      ...breakingChanges(
        old.additionalProperties,
        next.additionalProperties,
        `${at}.*`,
      ),
    );

  // arrays
  if (old.items !== undefined || next.items !== undefined)
    out.push(...breakingChanges(old.items, next.items, `${at}[]`));

  return out;
}

/**
 * Why `next` refuses something `oldBranch` accepted, or nothing when it does not.
 * When `next` is a union the closest branch is the one reported.
 */
function bestReasons(oldBranch: Json, next: Schema, at: string): string[] {
  const options = asArray(next.anyOf ?? next.oneOf);
  const rest = { ...next };
  delete rest.anyOf;
  delete rest.oneOf;
  const candidates = options.length
    ? options.map((b) => (isSchema(b) ? { ...rest, ...b } : b))
    : [next];
  let best: string[] | undefined;
  for (const candidate of candidates) {
    const reasons = breakingChanges(oldBranch, candidate, at);
    if (reasons.length === 0) return [];
    if (!best || reasons.length < best.length) best = reasons;
  }
  return best ?? [`${at}: nothing accepts it any more`];
}

// In-memory stand-in for the handful of Mongoose model methods the shop
// services use, so checkout / webhook / reconciliation scenarios run without a
// database. Supports the query + update operators those services use, unique
// indexes (E11000), timestamps, and Mongoose defaults/validation (documents are
// built with `new Model(doc)`, which works offline).
//
// Every call yields to the event loop first, so Promise.all() in a test
// interleaves like concurrent requests against a real DB.

const isOid = (v) => v && typeof v === 'object' && v._bsontype === 'ObjectId';
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isOid(v);
const norm = (v) => (v instanceof Date ? `d:${v.getTime()}` : isOid(v) ? `o:${v.toString()}` : v);
const eq = (a, b) => {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
    return norm(a) === norm(b);
};

const clone = (v) => {
    if (v instanceof Date) return new Date(v.getTime());
    if (isOid(v)) return v;
    if (Array.isArray(v)) return v.map(clone);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
    return v;
};

// All values at a dot path; arrays along the way fan out (Mongo semantics).
const valuesAt = (doc, path) => {
    let cur = [doc];
    for (const seg of path.split('.')) {
        const next = [];
        for (const c of cur) {
            if (c === null || c === undefined) continue;
            if (Array.isArray(c)) {
                for (const el of c) if (el && typeof el === 'object' && seg in el) next.push(el[seg]);
                if (/^\d+$/.test(seg) && c[Number(seg)] !== undefined) next.push(c[Number(seg)]);
            } else if (typeof c === 'object') {
                if (seg in c) next.push(c[seg]);
            }
        }
        cur = next;
    }
    // A terminal array also matches by its elements.
    const out = [];
    for (const v of cur) {
        out.push(v);
        if (Array.isArray(v)) out.push(...v);
    }
    return out;
};

const cmp = (a, b) => {
    const x = a instanceof Date ? a.getTime() : a;
    const y = b instanceof Date ? b.getTime() : b;
    return x < y ? -1 : x > y ? 1 : 0;
};
const comparable = (v) => v !== null && v !== undefined && !Array.isArray(v);

const matchCond = (doc, path, cond) => {
    const vals = valuesAt(doc, path);
    const isOps = isPlain(cond) && Object.keys(cond).length && Object.keys(cond).every((k) => k.startsWith('$'));
    if (!isOps) {
        if (cond === null) return vals.length === 0 || vals.some((v) => v === null || v === undefined);
        return vals.some((v) => eq(v, cond));
    }
    return Object.entries(cond).every(([op, arg]) => {
        switch (op) {
            case '$in': return arg.some((a) => (a === null ? matchCond(doc, path, null) : vals.some((v) => eq(v, a))));
            case '$nin': return !arg.some((a) => vals.some((v) => eq(v, a)));
            case '$ne': return arg === null ? vals.some((v) => v !== null && v !== undefined) : !vals.some((v) => eq(v, arg));
            case '$exists': return arg ? vals.length > 0 : vals.length === 0;
            case '$lt': return vals.some((v) => comparable(v) && cmp(v, arg) < 0);
            case '$lte': return vals.some((v) => comparable(v) && cmp(v, arg) <= 0);
            case '$gt': return vals.some((v) => comparable(v) && cmp(v, arg) > 0);
            case '$gte': return vals.some((v) => comparable(v) && cmp(v, arg) >= 0);
            case '$elemMatch': return vals.some((v) => isPlain(v) && matches(v, arg));
            case '$regex': {
                const re = arg instanceof RegExp ? arg : new RegExp(arg, cond.$options || '');
                return vals.some((v) => typeof v === 'string' && re.test(v));
            }
            case '$options': return true; // read together with $regex
            default: throw new Error(`fakeMongo: unsupported query operator ${op}`);
        }
    });
};

const matches = (doc, filter = {}) => Object.entries(filter).every(([k, cond]) => {
    if (k === '$or') return cond.some((f) => matches(doc, f));
    if (k === '$and') return cond.every((f) => matches(doc, f));
    if (k.startsWith('$')) throw new Error(`fakeMongo: unsupported top-level operator ${k}`);
    return matchCond(doc, k, cond);
});

// Resolve "items.$.x" using the filter's condition on the array.
const resolvePositional = (doc, path, filter) => {
    if (!path.includes('.$')) return path;
    const [prefix] = path.split('.$');
    const arr = valuesAt(doc, prefix).find(Array.isArray) || [];
    const subConds = Object.entries(filter).filter(([k]) => k.startsWith(`${prefix}.`));
    const elemMatch = filter[prefix]?.$elemMatch;
    const idx = arr.findIndex((el) => (elemMatch ? matches(el, elemMatch) : true)
        && subConds.every(([k, c]) => matchCond(el, k.slice(prefix.length + 1), c)));
    if (idx < 0) throw new Error(`fakeMongo: positional operator did not match for ${path}`);
    return path.replace('.$', `.${idx}`);
};

const setPath = (doc, path, value) => {
    const segs = path.split('.');
    let cur = doc;
    for (const s of segs.slice(0, -1)) {
        if (cur[s] === null || cur[s] === undefined || typeof cur[s] !== 'object') cur[s] = {};
        cur = cur[s];
    }
    cur[segs[segs.length - 1]] = value;
};
const getPath = (doc, path) => path.split('.').reduce((c, s) => (c === null || c === undefined ? undefined : c[s]), doc);
const unsetPath = (doc, path) => {
    const segs = path.split('.');
    const parent = getPath(doc, segs.slice(0, -1).join('.')) ?? (segs.length === 1 ? doc : undefined);
    if (parent && typeof parent === 'object') delete parent[segs[segs.length - 1]];
};

const applyUpdate = (doc, update, filter) => {
    for (const [op, fields] of Object.entries(update)) {
        if (!op.startsWith('$')) throw new Error('fakeMongo: replacement updates are not supported');
        for (const [rawPath, val] of Object.entries(fields)) {
            const path = resolvePositional(doc, rawPath, filter);
            switch (op) {
                case '$set': setPath(doc, path, clone(val)); break;
                case '$unset': unsetPath(doc, path); break;
                case '$inc': setPath(doc, path, (getPath(doc, path) || 0) + val); break;
                case '$push': {
                    const arr = getPath(doc, path) || [];
                    arr.push(clone(val));
                    setPath(doc, path, arr);
                    break;
                }
                case '$addToSet': {
                    const arr = getPath(doc, path) || [];
                    if (!arr.some((x) => eq(x, val))) arr.push(clone(val));
                    setPath(doc, path, arr);
                    break;
                }
                case '$pull': {
                    const arr = getPath(doc, path);
                    if (!Array.isArray(arr)) break;
                    const keep = arr.filter((el) => {
                        if (isPlain(val) && !Object.keys(val).every((k) => k.startsWith('$'))) return !matches(el, val);
                        return !matchCond({ v: el }, 'v', val);
                    });
                    setPath(doc, path, keep);
                    break;
                }
                default: throw new Error(`fakeMongo: unsupported update operator ${op}`);
            }
        }
    }
};

const dupError = (keys) => Object.assign(new Error(`E11000 duplicate key error (${keys.join(', ')})`), { code: 11000 });

const tick = () => new Promise((r) => setImmediate(r));

class FakeCollection {
    /**
     * @param {Model}  Model            the real Mongoose model (for defaults / validation)
     * @param {object} [opts]
     * @param {Array<string[]>} [opts.unique]  unique indexes, e.g. [['user', 'idempotencyKey']]
     */
    constructor(Model, { unique = [] } = {}) {
        this.Model = Model;
        this.unique = unique;
        this.docs = [];
        this.timestamps = Boolean(Model.schema.options.timestamps);
        this.calls = [];
    }

    checkUnique(candidate, ignore = null) {
        for (const keys of this.unique) {
            const clash = this.docs.some((d) => d !== ignore && keys.every((k) => {
                const a = getPath(d, k);
                return a !== undefined && eq(a, getPath(candidate, k));
            }));
            if (clash) throw dupError(keys);
        }
    }

    build(doc) {
        const built = new this.Model(doc);
        const err = built.validateSync();
        if (err) throw err;
        const obj = built.toObject({ depopulate: true });
        if (this.timestamps) {
            const now = new Date();
            obj.createdAt = obj.createdAt || now;
            obj.updatedAt = now;
        }
        return obj;
    }

    /** Insert directly (test setup), with defaults applied. */
    seed(doc) {
        const obj = this.build(doc);
        this.checkUnique(obj);
        this.docs.push(obj);
        return clone(obj);
    }

    raw(filter) { return this.docs.find((d) => matches(d, filter)); }

    query(run) {
        const state = { sort: null, limit: null, skip: 0 };
        const q = {
            select: () => q,
            lean: () => q,
            sort: (s) => { state.sort = s; return q; },
            limit: (n) => { state.limit = n; return q; },
            skip: (n) => { state.skip = n; return q; },
            exec: () => tick().then(() => run(state)),
            then: (res, rej) => q.exec().then(res, rej),
            catch: (rej) => q.exec().catch(rej),
        };
        return q;
    }

    sorted(list, sort) {
        if (!sort) return list;
        const keys = Object.entries(sort);
        return [...list].sort((a, b) => {
            for (const [k, dir] of keys) {
                const key = (v) => (v instanceof Date ? v.getTime() : isOid(v) ? v.toString() : v ?? '');
                const c = cmp(key(getPath(a, k)), key(getPath(b, k)));
                if (c) return c * dir;
            }
            return 0;
        });
    }

    // Mongo upsert: new doc = the filter's plain equality fields + the update.
    // A unique-index clash (the doc exists but the filter's guards missed it)
    // throws E11000, exactly like the real thing.
    upsertDoc(filter, update) {
        const base = {};
        for (const [k, v] of Object.entries(filter)) {
            if (k.startsWith('$') || k.includes('.')) continue;
            if (isPlain(v) && Object.keys(v).some((x) => x.startsWith('$'))) continue;
            base[k] = clone(v);
        }
        applyUpdate(base, update, {});
        const obj = this.build(base);
        this.checkUnique(obj);
        this.docs.push(obj);
        return obj;
    }

    updateDoc(doc, update, filter) {
        const next = clone(doc);
        applyUpdate(next, update, filter);
        if (this.timestamps) next.updatedAt = new Date();
        this.checkUnique(next, doc);
        Object.keys(doc).forEach((k) => delete doc[k]);
        Object.assign(doc, next);
    }

    install() {
        const M = this.Model;
        const self = this;
        const patched = {
            findOne(filter = {}) { self.calls.push(['findOne', filter]); return self.query(() => clone(self.raw(filter)) ?? null); },
            findById(id) { return patched.findOne({ _id: id }); },
            find(filter = {}) {
                self.calls.push(['find', filter]);
                return self.query((s) => {
                    let list = self.sorted(self.docs.filter((d) => matches(d, filter)), s.sort).slice(s.skip);
                    if (s.limit) list = list.slice(0, s.limit);
                    return list.map(clone);
                });
            },
            countDocuments(filter = {}) { return self.query(() => self.docs.filter((d) => matches(d, filter)).length); },
            async create(doc) {
                await tick();
                self.calls.push(['create', doc]);
                const obj = self.build(doc);
                self.checkUnique(obj);
                self.docs.push(obj);
                return clone(obj);
            },
            findOneAndUpdate(filter, update, opts = {}) {
                self.calls.push(['findOneAndUpdate', filter, update]);
                return self.query(() => {
                    if (opts.upsert) throw new Error('fakeMongo: upsert not supported');
                    const doc = self.raw(filter);
                    if (!doc) return null;
                    const before = clone(doc);
                    self.updateDoc(doc, update, filter);
                    return opts.new ? clone(doc) : before;
                });
            },
            updateOne(filter, update, opts = {}) {
                self.calls.push(['updateOne', filter, update]);
                return self.query(() => {
                    const doc = self.raw(filter);
                    if (!doc && opts.upsert) {
                        self.upsertDoc(filter, update);
                        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
                    }
                    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
                    self.updateDoc(doc, update, filter);
                    return { matchedCount: 1, modifiedCount: 1 };
                });
            },
            async bulkWrite(ops) {
                await tick();
                let matched = 0;
                for (const op of ops) {
                    if (!op.updateOne) throw new Error('fakeMongo: bulkWrite supports updateOne only');
                    const doc = self.raw(op.updateOne.filter);
                    if (doc) { matched += 1; self.updateDoc(doc, op.updateOne.update, op.updateOne.filter); }
                }
                return { matchedCount: matched };
            },
        };
        const saved = {};
        for (const [name, fn] of Object.entries(patched)) {
            saved[name] = Object.prototype.hasOwnProperty.call(M, name) ? M[name] : undefined;
            M[name] = fn;
        }
        return () => {
            for (const [name, fn] of Object.entries(saved)) {
                if (fn === undefined) delete M[name];
                else M[name] = fn;
            }
        };
    }
}

module.exports = { FakeCollection, matches, applyUpdate };

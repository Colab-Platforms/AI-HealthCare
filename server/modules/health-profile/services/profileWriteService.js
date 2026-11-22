const mongoose = require('mongoose');
const HealthProfile = require('../models/HealthProfile');
const { fromLegacyUser, toLegacyPatch } = require('./profileMapper');
const { mongoRepo, VersionConflictError } = require('./profileRepo');

// The ONLY write path for health profile data (onboarding, profile edit, chat,
// devices). Every call, in one transaction:
//   1. loads the HealthProfile (creating it from the legacy User if missing),
//   2. applies the change and validates it against the schema,
//   3. saves it with a version guard,
//   4. mirrors the changed sections into User.profile (existing features read it),
//   5. appends ProfileHistory entries (audit + undo).
// After commit it clears the auth user cache and health caches.

class ProfileInputError extends Error {
    constructor(message) {
        super(message);
        this.status = 400;
        this.code = 'PROFILE_INVALID_INPUT';
    }
}

class ProfileNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.status = 404;
        this.code = 'PROFILE_NOT_FOUND';
    }
}

const { SCALAR_SECTIONS, LIST_SECTIONS, SOURCES } = HealthProfile;

// Field that identifies a list item for duplicate detection.
const ITEM_KEY = {
    conditions: 'name',
    medications: 'name',
    allergies: 'allergen',
    surgeries: 'name',
    familyHistory: 'condition',
};

// Settable keys per scalar section, read from the schema so the two can't drift.
const SCALAR_KEYS = Object.fromEntries(SCALAR_SECTIONS.map((section) => {
    const keys = Object.keys(HealthProfile.schema.paths)
        .filter((p) => p.startsWith(`${section}.`) && !p.startsWith(`${section}.meta`))
        .map((p) => p.slice(section.length + 1));
    return [section, keys];
}));

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const norm = (s) => String(s || '').trim().toLowerCase();

function assertSource(source) {
    if (!SOURCES.includes(source)) throw new ProfileInputError(`Invalid source: ${source}`);
}
function assertScalar(section) {
    if (!SCALAR_SECTIONS.includes(section)) throw new ProfileInputError(`Unknown profile section: ${section}`);
}
function assertList(section) {
    if (!LIST_SECTIONS.includes(section)) throw new ProfileInputError(`Unknown profile list: ${section}`);
}

// Runs the schema (casting, defaults, enums, ranges) offline and returns a
// plain object ready to store.
function validated(profile) {
    const doc = new HealthProfile(profile);
    const err = doc.validateSync();
    if (err) {
        const details = Object.values(err.errors).map((e) => e.message).join('; ');
        throw new ProfileInputError(details || err.message);
    }
    return doc.toObject({ depopulate: true, versionKey: false });
}

function createProfileWriteService({ repo = mongoRepo, afterCommit = defaultAfterCommit, now = () => new Date() } = {}) {

    // Core transaction. mutate(profile, ctx) changes `profile` in place and
    // returns { sections: [...], changes: [history entries without user/source] }.
    async function write(userId, opts, mutate) {
        const { source, session: outerSession, expectedVersion } = opts;
        assertSource(source);

        const result = await repo.withTransaction(async (session) => {
            let stored = await repo.loadProfile(userId, session);
            let prevVersion = stored ? stored.version : null;
            let profile;

            if (stored) {
                profile = clone(stored);
            } else {
                // Not migrated yet: build from the legacy User so no fact is lost.
                const legacy = await repo.loadLegacyUser(userId, session);
                if (!legacy) throw new ProfileNotFoundError('User not found');
                profile = { _id: new mongoose.Types.ObjectId(), user: userId, version: 0, ...fromLegacyUser(legacy, 'migration', now()) };
            }

            if (expectedVersion !== undefined && expectedVersion !== null && stored && expectedVersion !== stored.version) {
                throw new VersionConflictError();
            }

            const { sections = [], changes = [], value } = await mutate(profile, { session, now: now() }) || {};
            if (changes.length === 0 && stored) return { profile: stored, changed: false, value };
            // Built from legacy data just now: record that in the audit log too.
            if (!stored && !changes.some((c) => c.action === 'create')) {
                changes.unshift({ field: '*', action: 'create', newValue: null });
            }

            profile.version = (profile.version || 0) + 1;
            const toSave = validated(profile);
            await repo.saveProfile(toSave, prevVersion, session);
            await repo.patchUser(userId, toLegacyPatch(toSave, sections), session);
            await repo.insertHistory(changes.map((c) => ({
                ...c,
                user: userId,
                source,
                profileVersion: toSave.version,
            })), session);

            return { profile: toSave, changed: true, sections, value };
        }, outerSession);

        if (result.changed && !outerSession) await afterCommit(userId, result.sections);
        return result;
    }

    // ── public API ─────────────────────────────────────────────────────────

    // Signup: User document already holds the onboarding profile; this creates
    // the matching HealthProfile. Pass the signup transaction's session.
    async function createFromOnboarding(userId, legacyUser, { session, source = 'manual' } = {}) {
        return write(userId, { source, session }, async (profile, ctx) => {
            if (profile.version !== 0) throw new VersionConflictError(); // already exists: never overwrite
            Object.assign(profile, fromLegacyUser(legacyUser, source, ctx.now));
            return {
                sections: [], // User already has this data; nothing to mirror
                changes: [{ field: '*', action: 'create', newValue: fromLegacyUser(legacyUser, source, ctx.now) }],
            };
        });
    }

    // Lazily creates the profile from legacy data if it doesn't exist yet.
    async function ensureProfile(userId, { session } = {}) {
        return write(userId, { source: 'migration', session }, async (profile) => {
            // A version of 0 means it was just built from the legacy user.
            if (profile.version !== 0) return { changes: [] };
            return { sections: [], changes: [{ field: '*', action: 'create', newValue: null }] };
        });
    }

    async function updateSection(userId, section, data, { source, verified = true, session, expectedVersion } = {}) {
        assertScalar(section);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProfileInputError('data must be an object');
        const unknown = Object.keys(data).filter((k) => !SCALAR_KEYS[section].includes(k));
        if (unknown.length) throw new ProfileInputError(`Unknown fields for ${section}: ${unknown.join(', ')}`);

        return write(userId, { source, session, expectedVersion }, async (profile, ctx) => {
            const current = profile[section] || {};
            const changes = [];
            for (const [key, value] of Object.entries(data)) {
                const next = value === null || value === '' ? undefined : value;
                if (same(current[key], next)) continue;
                changes.push({ field: `${section}.${key}`, action: 'set', oldValue: clone(current[key]), newValue: clone(next) });
                if (next === undefined) delete current[key];
                else current[key] = next;
            }
            if (!changes.length) return { changes };
            current.meta = { source, verified, updatedAt: ctx.now };
            profile[section] = current;
            return { sections: [section], changes };
        });
    }

    // Adds an item; if one with the same key (e.g. allergen) exists, updates it
    // instead so chat can't create duplicates. Returns the item id as `value`.
    async function addItem(userId, section, item, { source, verified = true, session, expectedVersion } = {}) {
        assertList(section);
        const keyField = ITEM_KEY[section];
        if (!item || !String(item[keyField] || '').trim()) throw new ProfileInputError(`${keyField} is required`);

        return write(userId, { source, session, expectedVersion }, async (profile, ctx) => {
            const listObj = profile[section] || { state: 'missing', items: [] };
            const existing = listObj.items.find((i) => norm(i[keyField]) === norm(item[keyField]));
            const fields = { ...item };
            delete fields._id;

            if (existing) {
                const before = clone(existing);
                Object.assign(existing, fields, { source, verified, updatedAt: ctx.now });
                if (same({ ...before, updatedAt: null }, { ...existing, updatedAt: null })) return { changes: [], value: existing._id };
                profile[section] = listObj;
                return {
                    sections: [section],
                    changes: [{ field: section, action: 'update_item', itemId: existing._id, oldValue: before, newValue: clone(existing) }],
                    value: existing._id,
                };
            }

            const newItem = { _id: new mongoose.Types.ObjectId(), ...fields, source, verified, updatedAt: ctx.now };
            const prevState = listObj.state;
            listObj.items.push(newItem);
            listObj.state = 'has_items';
            profile[section] = listObj;
            return {
                sections: [section],
                changes: [{ field: section, action: 'add_item', itemId: newItem._id, oldValue: { state: prevState }, newValue: clone(newItem) }],
                value: newItem._id,
            };
        });
    }

    async function updateItem(userId, section, itemId, patch, { source, verified = true, session, expectedVersion } = {}) {
        assertList(section);
        return write(userId, { source, session, expectedVersion }, async (profile, ctx) => {
            const listObj = profile[section] || { items: [] };
            const existing = listObj.items.find((i) => String(i._id) === String(itemId));
            if (!existing) throw new ProfileNotFoundError(`${section} item not found`);
            const before = clone(existing);
            const fields = { ...patch };
            delete fields._id;
            Object.assign(existing, fields, { source, verified, updatedAt: ctx.now });
            return {
                sections: [section],
                changes: [{ field: section, action: 'update_item', itemId: existing._id, oldValue: before, newValue: clone(existing) }],
            };
        });
    }

    async function removeItem(userId, section, itemId, { source, session, expectedVersion } = {}) {
        assertList(section);
        return write(userId, { source, session, expectedVersion }, async (profile) => {
            const listObj = profile[section] || { items: [] };
            const idx = listObj.items.findIndex((i) => String(i._id) === String(itemId));
            if (idx === -1) throw new ProfileNotFoundError(`${section} item not found`);
            const [removed] = listObj.items.splice(idx, 1);
            const prevState = listObj.state;
            // Deleting the last item is not the same as "I have none", so the coach may ask again.
            if (listObj.items.length === 0) listObj.state = 'missing';
            profile[section] = listObj;
            return {
                sections: [section],
                changes: [{ field: section, action: 'remove_item', itemId: removed._id, oldValue: { ...clone(removed), _prevState: prevState }, newValue: null }],
            };
        });
    }

    // "I have no allergies". Refused while items exist so a stray "no" in chat
    // can't wipe real allergies; the user removes them explicitly instead.
    async function markNone(userId, section, { source, session, expectedVersion } = {}) {
        assertList(section);
        return write(userId, { source, session, expectedVersion }, async (profile) => {
            const listObj = profile[section] || { state: 'missing', items: [] };
            if (listObj.items.length) throw new ProfileInputError(`${section} has items; remove them before marking none`);
            if (listObj.state === 'none') return { changes: [] };
            const prevState = listObj.state;
            listObj.state = 'none';
            profile[section] = listObj;
            return {
                sections: [section],
                changes: [{ field: section, action: 'mark_none', oldValue: { state: prevState }, newValue: { state: 'none' } }],
            };
        });
    }

    // Reverts one change. Only the latest change still in effect for that field
    // can be undone, so an undo never silently discards a newer edit.
    async function undo(userId, historyId, { source = 'manual', session } = {}) {
        return write(userId, { source, session }, async (profile, ctx) => {
            const entry = await repo.loadHistory(userId, historyId, ctx.session);
            if (!entry) throw new ProfileNotFoundError('Change not found');
            if (entry.undoneAt || entry.action === 'undo' || entry.action === 'create') {
                throw new ProfileInputError('This change cannot be undone');
            }
            const latest = await repo.latestActiveHistory(userId, entry.field, ctx.session);
            if (!latest || String(latest._id) !== String(entry._id)) {
                throw new ProfileInputError('A newer change exists for this field; undo that first');
            }

            const [section, key] = entry.field.split('.');
            const listObj = profile[section];
            switch (entry.action) {
                case 'set': {
                    profile[section] = profile[section] || {};
                    if (entry.oldValue === undefined || entry.oldValue === null) delete profile[section][key];
                    else profile[section][key] = entry.oldValue;
                    break;
                }
                case 'add_item': {
                    listObj.items = listObj.items.filter((i) => String(i._id) !== String(entry.itemId));
                    listObj.state = listObj.items.length ? 'has_items' : (entry.oldValue?.state || 'missing');
                    break;
                }
                case 'update_item': {
                    const i = listObj.items.findIndex((x) => String(x._id) === String(entry.itemId));
                    if (i === -1) throw new ProfileNotFoundError('Item no longer exists');
                    listObj.items[i] = entry.oldValue;
                    break;
                }
                case 'remove_item': {
                    const { _prevState, ...item } = entry.oldValue;
                    listObj.items.push(item);
                    listObj.state = 'has_items';
                    break;
                }
                case 'mark_none': {
                    listObj.state = entry.oldValue?.state || 'missing';
                    break;
                }
                default:
                    throw new ProfileInputError('This change cannot be undone');
            }

            await repo.markUndone(entry._id, ctx.session);
            return {
                sections: [section],
                changes: [{ field: entry.field, action: 'undo', itemId: entry.itemId, undoOf: entry._id, oldValue: entry.newValue, newValue: entry.oldValue }],
            };
        });
    }

    return { createFromOnboarding, ensureProfile, updateSection, addItem, updateItem, removeItem, markNone, undo };
}

// Clears what was derived from the old profile. Never throws: the write has
// already committed, and caches expire on their own.
async function defaultAfterCommit(userId) {
    try {
        require('../../../utils/userCache').invalidate(userId);
        const cache = require('../../../utils/cache');
        const { invalidateUserHealthCache } = require('../../../utils/cacheKeys');
        await Promise.all([
            cache.deletePattern(`profile:ctx:${userId}:*`),
            invalidateUserHealthCache(userId),
        ]);
    } catch (err) {
        console.error('[HealthProfile] cache invalidation failed:', err.message);
    }
}

module.exports = {
    ...createProfileWriteService(),
    createProfileWriteService,
    ProfileInputError,
    ProfileNotFoundError,
    VersionConflictError,
};

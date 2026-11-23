const mongoose = require('mongoose');
const HealthProfile = require('../models/HealthProfile');

// /api/health-profile handlers. The user is always req.user (from protect),
// never an id from the URL or body. Every write goes through
// ProfileWriteService with source 'manual'; clients cannot set provenance
// (source, verified, updatedAt) or ids.
//
// Body shapes:
//   PATCH /:section                  { data: {...fields}, version? }
//   POST  /:section/items            { item: {...fields}, version? }
//   PATCH /:section/items/:itemId    { data: {...fields}, version? }
//   DELETE /:section/items/:itemId   { version? }
//   POST  /:section/none             { version? }
//   POST  /undo/:historyId
// `version` (from the last GET) makes the write fail with 409 if the profile
// changed since, so two devices can't silently overwrite each other.

const { SCALAR_SECTIONS, LIST_SECTIONS } = HealthProfile;
const SERVER_ONLY = new Set(['_id', 'id', 'source', 'verified', 'updatedAt', 'createdAt', '__v', 'meta']);

// Editable fields of a list item, read from the schema so they can't drift.
const ITEM_FIELDS = Object.fromEntries(LIST_SECTIONS.map((section) => {
    const paths = Object.keys(HealthProfile.schema.path(`${section}.items`).schema.paths);
    return [section, paths.filter((p) => !SERVER_ONLY.has(p))];
}));

const HISTORY_LIMIT_DEFAULT = 20;
const HISTORY_LIMIT_MAX = 100;

class RequestError extends Error {
    constructor(message, code = 'PROFILE_INVALID_INPUT') {
        super(message);
        this.status = 400;
        this.code = code;
    }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function parseVersion(body) {
    const v = body?.version;
    if (v === undefined || v === null) return undefined;
    if (!Number.isInteger(v) || v < 0) throw new RequestError('version must be a non-negative integer');
    return v;
}

function objectBody(body, key) {
    const value = body?.[key];
    if (!isPlainObject(value) || !Object.keys(value).length) throw new RequestError(`${key} must be a non-empty object`);
    return value;
}

function scalarSection(section) {
    if (!SCALAR_SECTIONS.includes(section)) throw new RequestError(`Unknown profile section: ${section}`);
    return section;
}

function listSection(section) {
    if (!LIST_SECTIONS.includes(section)) throw new RequestError(`Unknown profile list: ${section}`);
    return section;
}

function objectId(value, name) {
    if (!mongoose.isValidObjectId(value)) throw new RequestError(`Invalid ${name}`);
    return value;
}

// Rejects provenance/id fields and anything the item schema doesn't know.
function itemFields(section, fields) {
    const bad = Object.keys(fields).filter((k) => !ITEM_FIELDS[section].includes(k));
    if (bad.length) throw new RequestError(`Fields not allowed for ${section}: ${bad.join(', ')}`);
    return fields;
}

function createHealthProfileController({
    write = require('../services/profileWriteService'),
    read = require('../services/profileContextService'),
    repo = require('../services/profileRepo').mongoRepo,
    sideEffects = require('../services/profileSideEffects').createProfileSideEffects(),
    completeness = require('../services/completeness').computeCompleteness,
    logger = console,
} = {}) {
    const { toView } = require('../services/profileContextService');

    // Known errors (400/404/409) go back as-is; anything else is a 500 with no
    // internal detail.
    const handle = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            if ([400, 404, 409].includes(err.status)) {
                return res.status(err.status).json({ success: false, code: err.code, message: err.message });
            }
            logger.error(`[HealthProfile] ${req.method} ${req.originalUrl} failed for user ${req.user?._id}:`, err);
            return res.status(500).json({ success: false, message: 'Could not update your health profile. Please try again.' });
        }
    };

    // Common tail of every write: side effects for changed sections, then the
    // fresh profile so the app never needs a second GET.
    async function respondWrite(req, res, result, extra = {}) {
        if (result.changed) await sideEffects.afterProfileChange(req.user._id, result.sections || []);
        return res.json({ success: true, changed: Boolean(result.changed), ...extra, ...toView(result.profile) });
    }

    const opts = (req) => ({ source: 'manual', expectedVersion: parseVersion(req.body) });

    return {
        getProfile: handle(async (req, res) => {
            const result = await read.getProfile(req.user._id);
            if (!result) return res.status(404).json({ success: false, code: 'PROFILE_NOT_FOUND', message: 'User not found' });
            return res.json({ success: true, ...result });
        }),

        getCompleteness: handle(async (req, res) => {
            const result = await read.getProfile(req.user._id);
            if (!result) return res.status(404).json({ success: false, code: 'PROFILE_NOT_FOUND', message: 'User not found' });
            return res.json({ success: true, ...completeness(result.profile) });
        }),

        getHistory: handle(async (req, res) => {
            const { field, before } = req.query;
            if (field !== undefined && (typeof field !== 'string' || !/^[A-Za-z.*]{1,60}$/.test(field))) {
                throw new RequestError('Invalid field');
            }
            if (before !== undefined) objectId(before, 'before');
            let limit = HISTORY_LIMIT_DEFAULT;
            if (req.query.limit !== undefined) {
                limit = Number(req.query.limit);
                if (!Number.isInteger(limit) || limit < 1 || limit > HISTORY_LIMIT_MAX) {
                    throw new RequestError(`limit must be 1-${HISTORY_LIMIT_MAX}`);
                }
            }
            const rows = await repo.listHistory(req.user._id, { field, before, limit });
            return res.json({
                success: true,
                history: rows.map((h) => ({
                    id: h._id,
                    field: h.field,
                    action: h.action,
                    itemId: h.itemId,
                    oldValue: h.oldValue,
                    newValue: h.newValue,
                    source: h.source,
                    createdAt: h.createdAt,
                    undoneAt: h.undoneAt,
                    undoOf: h.undoOf,
                })),
                nextBefore: rows.length === limit ? rows[rows.length - 1]._id : null,
            });
        }),

        updateSection: handle(async (req, res) => {
            const section = scalarSection(req.params.section);
            const data = objectBody(req.body, 'data');
            const result = await write.updateSection(req.user._id, section, data, opts(req));
            return respondWrite(req, res, result);
        }),

        addItem: handle(async (req, res) => {
            const section = listSection(req.params.section);
            const item = itemFields(section, objectBody(req.body, 'item'));
            const result = await write.addItem(req.user._id, section, item, opts(req));
            return respondWrite(req, res, result, { itemId: result.value });
        }),

        updateItem: handle(async (req, res) => {
            const section = listSection(req.params.section);
            const itemId = objectId(req.params.itemId, 'itemId');
            const data = itemFields(section, objectBody(req.body, 'data'));
            const result = await write.updateItem(req.user._id, section, itemId, data, opts(req));
            return respondWrite(req, res, result);
        }),

        removeItem: handle(async (req, res) => {
            const section = listSection(req.params.section);
            const itemId = objectId(req.params.itemId, 'itemId');
            const result = await write.removeItem(req.user._id, section, itemId, opts(req));
            return respondWrite(req, res, result);
        }),

        markNone: handle(async (req, res) => {
            const section = listSection(req.params.section);
            const result = await write.markNone(req.user._id, section, opts(req));
            return respondWrite(req, res, result);
        }),

        undo: handle(async (req, res) => {
            const historyId = objectId(req.params.historyId, 'historyId');
            const result = await write.undo(req.user._id, historyId, { source: 'manual' });
            return respondWrite(req, res, result);
        }),
    };
}

module.exports = { createHealthProfileController, ITEM_FIELDS };

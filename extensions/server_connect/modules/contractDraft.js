const BreakError = require('../../../lib/errors/breakError');

module.exports = {
    remove: async function (options) {
        const contractId = Number(this.req.body?.contractId || this.req.query?.id);
        const tenantId = Number(this.req.session?.TENANT_ID);
        const userId = Number(this.req.session?.USER_ID);
        if (!Number.isInteger(contractId) || contractId <= 0) {
            throw new Error(`contractDraft.remove: contractId is required (url: ${this.req.originalUrl || 'unknown'}).`);
        }
        if (!Number.isInteger(tenantId) || tenantId <= 0) {
            throw new Error('contractDraft.remove: tenantId is required.');
        }
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new Error('contractDraft.remove: userId is required.');
        }
        const db = this.getDbConnection('db');

        const contract = await db('tbl_generated_contracts as gc')
            .where({ 'gc.id': contractId, 'gc.tenantId': tenantId, 'gc.status': 'draft' })
            .whereExists(function () {
                this.select(db.raw('1'))
                    .from('tbl_tenant_modules as tm')
                    .innerJoin('tbl_modules as m', 'm.id', 'tm.moduleId')
                    .whereRaw('tm.tenantId = gc.tenantId')
                    .where('m.moduleCode', 'CONTRACT_GENERATION')
                    .where('m.isActive', 1)
                    .whereIn('tm.status', ['ACTIVE', 'TRIAL']);
            })
            .whereExists(function () {
                this.select(db.raw('1'))
                    .from('tbl_user_tenant_roles as utr')
                    .innerJoin('tbl_roles as r', 'r.id', 'utr.roleId')
                    .whereRaw('utr.userId = ?', [userId])
                    .whereRaw('utr.tenantId = gc.tenantId')
                    .where('utr.isActive', 1)
                    .whereIn('r.roleKey', ['owner', 'admin']);
            })
            .select('gc.id', 'gc.workflowId', 'gc.contractVersionNumber')
            .first();

        if (!contract) {
            this.res.status(403).json({ success: false, message: 'The editable contract draft is unavailable.' });
            throw new BreakError();
        }

        if (Number(contract.contractVersionNumber || 0) === 0) {
            await db.transaction(async trx => {
                await trx('tbl_contract_document_clauses').where({ tenantId, contractId }).del();
                await trx('tbl_generated_contracts').where({ id: contractId, tenantId, status: 'draft' }).del();
            });
            return { success: true, action: 'deleted', workflowId: contract.workflowId };
        }

        const version = await db('tbl_contract_versions')
            .where({
                tenantId,
                contractId,
                contractVersionNumber: contract.contractVersionNumber
            })
            .first();

        if (!version) throw new Error('The latest issued version could not be restored.');

        let clauses;
        try {
            clauses = JSON.parse(version.clausesJsonSnapshot || '[]');
        } catch {
            throw new Error('The issued clause snapshot is invalid and the draft cannot be discarded safely.');
        }

        const wasSent = await db('tbl_contract_deliveries')
            .where({ tenantId, contractId, pdfSha256Snapshot: version.pdfSha256 })
            .first();

        await db.transaction(async trx => {
            await trx('tbl_contract_document_clauses').where({ tenantId, contractId }).del();

            if (clauses.length) {
                await trx('tbl_contract_document_clauses').insert(clauses.map((clause, index) => ({
                    tenantId,
                    contractId,
                    sourceClauseId: null,
                    clauseHeading: clause.clauseHeading,
                    clauseTextSnapshot: clause.clauseTextSnapshot,
                    clauseBehaviour: clause.clauseBehaviour || 'optional',
                    conditionKey: clause.conditionKey || null,
                    displayOrder: clause.displayOrder == null ? ((index + 1) * 10) : clause.displayOrder,
                    isIncluded: clause.clauseBehaviour === 'mandatory' ? 1 : Number(clause.isIncluded !== 0),
                    isCustom: Number(clause.isCustom || 0),
                    createdByUserId: userId,
                    modifiedByUserId: userId
                })));
            }

            await trx('tbl_generated_contracts')
                .where({ id: contractId, tenantId, status: 'draft' })
                .update({
                    contractName: version.contractNameSnapshot,
                    renderedHtml: version.renderedHtmlSnapshot,
                    status: wasSent ? 'sent' : 'issued',
                    pdfStoragePath: version.pdfStoragePath,
                    pdfFileName: version.pdfFileName,
                    pdfSha256: version.pdfSha256,
                    pdfGeneratedDate: version.issuedDate,
                    issuedByUserId: version.issuedByUserId,
                    issuedDate: version.issuedDate,
                    draftModifiedDate: null,
                    draftModifiedByUserId: null,
                    modifiedByUserId: userId,
                    modifiedDate: db.fn.now()
                });
        });

        return { success: true, action: 'discarded', workflowId: contract.workflowId };
    }
};

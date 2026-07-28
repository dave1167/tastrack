function contactSnapshot(contact) {
    if (!contact) return null;
    const personName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
    return {
        id: contact.id,
        name: personName || contact.displayName || contact.tradingName || contact.legalName || contact.organisationName || '',
        legalName: contact.legalName || contact.organisationName || contact.displayName || personName || '',
        tradingName: contact.tradingName || contact.organisationName || '',
        organisationName: contact.organisationName || '',
        jobTitle: contact.jobTitle || '',
        email: contact.email || '',
        phone: contact.phone || '',
        registrationNumber: contact.registrationNumber || '',
        vatNumber: contact.vatNumber || '',
        website: contact.website || '',
        address: [contact.addressLine1, contact.addressLine2, contact.city, contact.region, contact.postcode, contact.country].filter(Boolean).join(', ')
    };
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function clauseInsertHtml(heading, html) {
    let body = String(html || '');
    const leadingHeading = body.match(/^\s*<h([1-6])[^>]*>([\s\S]*?)<\/h\1>\s*/i);
    if (leadingHeading) {
        const headingText = leadingHeading[2].replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
        if (headingText.toLowerCase() === String(heading || '').trim().toLowerCase()) {
            body = body.slice(leadingHeading[0].length);
        }
    }
    return `<section class="contract-clause"><h2>${escapeHtml(heading)}</h2><div class="contract-clause-body">${body}</div></section><p><br></p>`;
}

function mergeFields(html, snapshot) {
    const values = {
        'event.name': snapshot.event?.name,
        'event.reference': snapshot.event?.reference,
        'event.showDate': snapshot.event?.showDate,
        'event.showTime': snapshot.event?.showTime,
        'location.name': snapshot.event?.locationName,
        'space.name': snapshot.event?.spaceName,
        'configuration.name': snapshot.event?.configurationName,
        'tenant.name': snapshot.tenantName,
        'contractingEntity.legalName': snapshot.contractingEntity?.legalName,
        'contractingEntity.tradingName': snapshot.contractingEntity?.tradingName,
        'contractingEntity.registrationNumber': snapshot.contractingEntity?.registrationNumber,
        'contractingEntity.vatNumber': snapshot.contractingEntity?.vatNumber,
        'contractingEntity.registeredAddress': snapshot.contractingEntity?.registeredAddress,
        'contractingEntity.signatoryName': snapshot.contractingEntity?.signatoryName,
        'contractingEntity.signatoryTitle': snapshot.contractingEntity?.signatoryTitle,
        'contractingEntity.paymentTerms': snapshot.contractingEntity?.paymentTerms,
        'contractingEntity.footer': snapshot.contractingEntity?.footer,
        'contractParty.name': snapshot.contractParty?.name,
        'contractParty.legalName': snapshot.contractParty?.legalName,
        'contractParty.tradingName': snapshot.contractParty?.tradingName,
        'contractParty.address': snapshot.contractParty?.address,
        'contractParty.registrationNumber': snapshot.contractParty?.registrationNumber,
        'contractParty.vatNumber': snapshot.contractParty?.vatNumber,
        'contractParty.email': snapshot.contractParty?.email,
        'contractParty.phone': snapshot.contractParty?.phone,
        'artist.name': snapshot.artist?.name,
        'artist.legalName': snapshot.artist?.legalName,
        'artist.email': snapshot.artist?.email,
        'manager.name': snapshot.manager?.name,
        'manager.organisationName': snapshot.manager?.organisationName,
        'manager.email': snapshot.manager?.email,
        'manager.phone': snapshot.manager?.phone,
        'promoter.name': snapshot.promoter?.name,
        'promoter.legalName': snapshot.promoter?.legalName,
        'promoter.email': snapshot.promoter?.email,
        'agent.name': snapshot.agent?.name,
        'agent.organisationName': snapshot.agent?.organisationName,
        'agent.email': snapshot.agent?.email,
        'agent.phone': snapshot.agent?.phone,
        'signatory.name': snapshot.signatory?.name,
        'signatory.title': snapshot.signatory?.jobTitle,
        'signatory.email': snapshot.signatory?.email,
        'financeContact.name': snapshot.financeContact?.name,
        'financeContact.email': snapshot.financeContact?.email,
        'financeContact.phone': snapshot.financeContact?.phone,
        eventName: snapshot.event?.name,
        eventDate: snapshot.event?.showDate,
        venueName: snapshot.event?.locationName,
        contractFee: snapshot.event?.contractFee,
        depositAmount: snapshot.event?.depositAmount,
        balanceDueDate: snapshot.event?.balanceDueDate,
        artistName: snapshot.artist?.name,
        tenantName: snapshot.tenantName
    };

    let result = String(html || '');
    Object.entries(values).forEach(([key, value]) => {
        result = result.split(`{{${key}}}`).join(value || '');
    });
    return result;
}

async function buildContractSnapshot(db, contract, tenantId) {
    const details = await db('tbl_workflow_contract_details')
        .where({ tenantId, workflowId: contract.workflowId })
        .first();
    const tenant = await db('tbl_tenants').where({ id: tenantId }).select('tenantName').first();
    const event = await db('tbl_workflows as w')
        .leftJoin('tbl_locations as l', function () {
            this.on('l.id', 'w.locationId').andOn('l.tenantId', 'w.tenantId');
        })
        .leftJoin('tbl_spaces as s', function () {
            this.on('s.id', 'w.spaceId').andOn('s.tenantId', 'w.tenantId');
        })
        .leftJoin('tbl_space_configurations as c', function () {
            this.on('c.id', 'w.configurationId').andOn('c.tenantId', 'w.tenantId');
        })
        .where({ 'w.id': contract.workflowId, 'w.tenantId': tenantId })
        .select('w.workflowName as name', 'w.referenceCode as reference', 'w.targetDate', 'l.locationName', 's.spaceName', 'c.configurationName')
        .first();
    const fieldValues = await db('tbl_workflow_field_values')
        .where({ tenantId, workflowId: contract.workflowId })
        .whereIn('fieldKey', ['show_date', 'show_time', 'contract_fee', 'deposit_amount', 'balance_due_date'])
        .select('fieldKey', 'valueText', 'valueDate');
    const fields = Object.fromEntries(fieldValues.map(field => [field.fieldKey, field]));
    const formatDate = value => {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric'
        }).format(date);
    };
    const roleColumns = {
        contractParty: 'contractPartyContactId',
        artist: 'artistContactId',
        manager: 'managerContactId',
        promoter: 'promoterContactId',
        agent: 'agentContactId',
        signatory: 'signatoryContactId',
        financeContact: 'financeContactId'
    };
    const ids = [...new Set(Object.values(roleColumns).map(column => details?.[column]).filter(Boolean))];
    const contacts = ids.length
        ? await db('tbl_contacts').where({ tenantId, isActive: 1 }).whereIn('id', ids).select()
        : [];
    const byId = new Map(contacts.map(contact => [Number(contact.id), contact]));
    let contractingEntity = {};
    try {
        contractingEntity = typeof contract.contractingEntitySnapshot === 'string'
            ? JSON.parse(contract.contractingEntitySnapshot || '{}')
            : (contract.contractingEntitySnapshot || {});
    } catch {
        contractingEntity = {};
    }
    const snapshot = {
        tenantName: tenant?.tenantName || '',
        contractingEntity,
        event: {
            name: event?.name || '',
            reference: event?.reference || '',
            showDate: formatDate(fields.show_date?.valueDate || event?.targetDate),
            showTime: fields.show_time?.valueText || '',
            locationName: event?.locationName || '',
            spaceName: event?.spaceName || '',
            configurationName: event?.configurationName || '',
            contractFee: fields.contract_fee?.valueText || '',
            depositAmount: fields.deposit_amount?.valueText || '',
            balanceDueDate: formatDate(fields.balance_due_date?.valueDate) || fields.balance_due_date?.valueText || ''
        }
    };
    Object.entries(roleColumns).forEach(([role, column]) => {
        snapshot[role] = contactSnapshot(byId.get(Number(details?.[column])));
    });
    return snapshot;
}

module.exports = {
    snapshot: async function (options) {
        const requestContractId = options.contractId || this.req?.body?.contractId || this.req?.query?.id;
        const contractId = this.parseRequired(requestContractId, 'number', 'contractParties.snapshot: contractId is required.');
        const tenantId = this.parseRequired(options.tenantId, 'number', 'contractParties.snapshot: tenantId is required.');
        const db = this.getDbConnection('db');

        const contract = await db('tbl_generated_contracts')
            .where({ id: contractId, tenantId, status: 'draft' })
            .select('id', 'workflowId', 'renderedHtml', 'contractingEntitySnapshot')
            .first();
        if (!contract) throw new Error('The contract draft is unavailable.');

        const details = await db('tbl_workflow_contract_details')
            .where({ tenantId, workflowId: contract.workflowId })
            .first();
        const tenant = await db('tbl_tenants').where({ id: tenantId }).select('tenantName').first();
        const event = await db('tbl_workflows as w')
            .leftJoin('tbl_locations as l', function () {
                this.on('l.id', 'w.locationId').andOn('l.tenantId', 'w.tenantId');
            })
            .leftJoin('tbl_spaces as s', function () {
                this.on('s.id', 'w.spaceId').andOn('s.tenantId', 'w.tenantId');
            })
            .leftJoin('tbl_space_configurations as c', function () {
                this.on('c.id', 'w.configurationId').andOn('c.tenantId', 'w.tenantId');
            })
            .where({ 'w.id': contract.workflowId, 'w.tenantId': tenantId })
            .select('w.workflowName as name', 'w.referenceCode as reference', 'w.targetDate', 'l.locationName', 's.spaceName', 'c.configurationName')
            .first();
        const fieldValues = await db('tbl_workflow_field_values')
            .where({ tenantId, workflowId: contract.workflowId })
            .whereIn('fieldKey', ['show_date', 'show_time', 'contract_fee', 'deposit_amount', 'balance_due_date'])
            .select('fieldKey', 'valueText', 'valueDate');
        const fields = Object.fromEntries(fieldValues.map(field => [field.fieldKey, field]));
        const formatDate = value => {
            if (!value) return '';
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
        };

        const roleColumns = {
            contractParty: 'contractPartyContactId',
            artist: 'artistContactId',
            manager: 'managerContactId',
            promoter: 'promoterContactId',
            agent: 'agentContactId',
            signatory: 'signatoryContactId',
            financeContact: 'financeContactId'
        };
        const ids = [...new Set(Object.values(roleColumns).map(column => details?.[column]).filter(Boolean))];
        const contacts = ids.length
            ? await db('tbl_contacts').where({ tenantId, isActive: 1 }).whereIn('id', ids).select()
            : [];
        const byId = new Map(contacts.map(contact => [Number(contact.id), contact]));
        let contractingEntity = {};
        try {
            contractingEntity = typeof contract.contractingEntitySnapshot === 'string'
                ? JSON.parse(contract.contractingEntitySnapshot || '{}')
                : (contract.contractingEntitySnapshot || {});
        } catch {
            contractingEntity = {};
        }
        const snapshot = {
            tenantName: tenant?.tenantName || '',
            contractingEntity,
            event: {
                name: event?.name || '',
                reference: event?.reference || '',
                showDate: formatDate(fields.show_date?.valueDate || event?.targetDate),
                showTime: fields.show_time?.valueText || '',
                locationName: event?.locationName || '',
                spaceName: event?.spaceName || '',
                configurationName: event?.configurationName || '',
                contractFee: fields.contract_fee?.valueText || '',
                depositAmount: fields.deposit_amount?.valueText || '',
                balanceDueDate: formatDate(fields.balance_due_date?.valueDate) || fields.balance_due_date?.valueText || ''
            }
        };
        Object.entries(roleColumns).forEach(([role, column]) => {
            snapshot[role] = contactSnapshot(byId.get(Number(details?.[column])));
        });

        const clauses = await db('tbl_contract_document_clauses').where({ tenantId, contractId }).select('id', 'clauseTextSnapshot');
        await db.transaction(async trx => {
            await trx('tbl_generated_contracts').where({ id: contractId, tenantId, status: 'draft' }).update({
                contractPartiesSnapshot: JSON.stringify(snapshot),
                renderedHtml: mergeFields(contract.renderedHtml, snapshot),
                modifiedDate: db.fn.now()
            });
            for (const clause of clauses) {
                await trx('tbl_contract_document_clauses').where({ id: clause.id, tenantId, contractId }).update({
                    clauseTextSnapshot: mergeFields(clause.clauseTextSnapshot, snapshot)
                });
            }
        });

        return { success: true, contractId };
    }
};

(function () {
    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (character) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
        });
    }

    function insertClause(draftBody, heading, clauseHtml) {
        if (!draftBody || !jQuery(draftBody).next('.note-editor').length) return;
        var body = String(clauseHtml || '');
        var leadingHeading = body.match(/^\s*<h([1-6])[^>]*>([\s\S]*?)<\/h\1>\s*/i);
        if (leadingHeading) {
            var headingText = leadingHeading[2].replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
            if (headingText.toLowerCase() === String(heading || '').trim().toLowerCase()) {
                body = body.slice(leadingHeading[0].length);
            }
        }
        var html = '<section class="contract-clause"><h2><span class="contract-clause-number"></span>' + escapeHtml(heading) +
            '</h2><div class="contract-clause-body">' + body +
            '</div></section><p><br></p>';
        jQuery(draftBody).summernote('pasteHTML', html);
        renumberDraft(draftBody);
        var notice = document.getElementById('contractClauseInsertNotice');
        if (notice) {
            notice.classList.remove('d-none');
            notice.textContent = '"' + heading + '" has been inserted into the contract. Save the draft when you have finished editing.';
        }
        draftBody.scrollIntoView({ behavior: 'smooth', block: 'center' });
        jQuery(draftBody).summernote('focus');
    }

    function renumberDraft(draftBody) {
        var editor = jQuery(draftBody);
        if (!editor.next('.note-editor').length) return;
        var container = document.createElement('div');
        container.innerHTML = editor.summernote('code') || '';
        container.querySelectorAll('.contract-clause').forEach(function (clause, clauseIndex) {
            var clauseNumber = clauseIndex + 1;
            var heading = clause.querySelector('h1,h2,h3,h4,h5,h6');
            if (heading) {
                var number = heading.querySelector('.contract-clause-number');
                if (!number) {
                    number = document.createElement('span');
                    number.className = 'contract-clause-number';
                    heading.insertBefore(number, heading.firstChild);
                }
                number.textContent = clauseNumber + '. ';
            }
            clause.querySelectorAll('.contract-subclause-number').forEach(function (number) { number.remove(); });
            clause.querySelectorAll('.contract-clause-body > ol > li').forEach(function (item, itemIndex) {
                var number = document.createElement('span');
                number.className = 'contract-subclause-number';
                number.textContent = clauseNumber + '.' + (itemIndex + 1) + ' ';
                number.style.fontWeight = '600';
                item.insertBefore(number, item.firstChild);
            });
        });
        editor.summernote('code', container.innerHTML);
        synchroniseEditor(draftBody);
    }

    function synchroniseEditor(element) {
        var editor = jQuery(element);
        if (editor.next('.note-editor').length) {
            editor.val(editor.summernote('code'));
        }
    }

    function serverData(id) {
        var element = document.getElementById(id);
        return element && element.dmxComponent ? element.dmxComponent.data.data || {} : {};
    }

    function contactSnapshot(contact) {
        contact = contact || {};
        return {
            name: contact.contactName || '',
            legalName: contact.legalName || contact.organisationName || contact.contactName || '',
            tradingName: contact.tradingName || contact.organisationName || '',
            organisationName: contact.organisationName || '',
            jobTitle: contact.jobTitle || '',
            email: contact.email || '',
            phone: contact.phone || '',
            registrationNumber: contact.registrationNumber || '',
            vatNumber: contact.vatNumber || '',
            website: contact.website || '',
            address: [contact.addressLine1, contact.addressLine2, contact.city, contact.region, contact.postcode, contact.country]
                .filter(Boolean).join(', ')
        };
    }

    function liveContractSnapshot() {
        var contract = (serverData('scContractDraft').contract || [])[0] || {};
        var workflow = (serverData('scContractWorkflow').query || [])[0] || {};
        var details = (serverData('scContractPartyDetails').details || [])[0] || {};
        var contacts = serverData('scContractContactOptions').query || [];
        var fields = {};
        (serverData('scContractFieldValues').values || []).forEach(function (field) {
            fields[field.fieldKey] = field.valueText || field.valueDate || field.valueMoney || field.valueNumber || '';
        });
        var byId = {};
        contacts.forEach(function (contact) { byId[String(contact.id)] = contact; });
        var entity = contract.contractingEntitySnapshot || {};
        if (typeof entity === 'string') {
            try { entity = JSON.parse(entity); } catch (error) { entity = {}; }
        }
        var snapshot = {
            tenantName: contract.tenantName || '',
            contractingEntity: entity,
            event: {
                name: workflow.workflowName || contract.workflowName || '',
                reference: workflow.referenceCode || '',
                showDate: fields.show_date || workflow.showDate || '',
                showTime: fields.show_time || workflow.showTime || '',
                locationName: workflow.locationName || '',
                spaceName: workflow.spaceName || '',
                configurationName: workflow.configurationName || '',
                contractFee: fields.contract_fee || '',
                depositAmount: fields.deposit_amount || '',
                balanceDueDate: fields.balance_due_date || ''
            }
        };
        var roles = {
            contractParty: 'contractPartyContactId', artist: 'artistContactId',
            manager: 'managerContactId', promoter: 'promoterContactId',
            agent: 'agentContactId', signatory: 'signatoryContactId',
            financeContact: 'financeContactId'
        };
        Object.keys(roles).forEach(function (role) {
            snapshot[role] = contactSnapshot(byId[String(details[roles[role]] || '')]);
        });
        return snapshot;
    }

    function mergeClauseFields(html, snapshot) {
        var event = snapshot.event || {};
        var values = {
            eventName: event.name,
            eventDate: event.showDate,
            venueName: event.locationName,
            artistName: (snapshot.artist || {}).name,
            contractFee: event.contractFee,
            depositAmount: event.depositAmount,
            balanceDueDate: event.balanceDueDate,
            tenantName: snapshot.tenantName,
            'event.name': event.name,
            'event.reference': event.reference,
            'event.showDate': event.showDate,
            'event.showTime': event.showTime,
            'location.name': event.locationName,
            'space.name': event.spaceName,
            'configuration.name': event.configurationName,
            'tenant.name': snapshot.tenantName
        };
        ['contractingEntity', 'contractParty', 'artist', 'manager', 'promoter', 'agent', 'signatory', 'financeContact'].forEach(function (group) {
            var record = snapshot[group] || {};
            Object.keys(record).forEach(function (key) {
                values[group + '.' + key] = record[key];
            });
        });
        var merged = String(html || '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (token, field) {
            if (!Object.prototype.hasOwnProperty.call(values, field)) return token;
            var value = values[field];
            var display = value == null || String(value).trim() === '' ? '[' + field + ' not provided]' : String(value);
            return '<span class="contract-merge-field" data-merge-field="' + escapeHtml(field) + '">' + escapeHtml(display) + '</span>';
        });
        var container = document.createElement('div');
        container.innerHTML = merged;
        container.querySelectorAll('[data-merge-field]').forEach(function (element) {
            var field = element.getAttribute('data-merge-field');
            if (!Object.prototype.hasOwnProperty.call(values, field)) return;
            var value = values[field];
            element.textContent = value == null || String(value).trim() === '' ? '[' + field + ' not provided]' : String(value);
        });
        return container.innerHTML;
    }

    function initialiseDraftPage() {
        if (!window.jQuery || !jQuery.fn.summernote) return;

        var draftBody = document.getElementById('contractDraftBody');
        var draftForm = document.getElementById('contractDraftForm');
        var contractId = new URLSearchParams(window.location.search).get('id');
        if (draftForm && contractId) {
            draftForm.removeAttribute('onsubmit');
            var contractIdInput = draftForm.querySelector('input[name="contractId"]');
            if (contractIdInput) {
                contractIdInput.value = contractId;
                contractIdInput.setAttribute('value', contractId);
            }
            draftForm.action = '/api/contracts/updateDraft?id=' + encodeURIComponent(contractId);
        }
        var issueForm = document.querySelector('form[action="/api/contracts/issueVersioned"]');
        if (issueForm && contractId) {
            issueForm.action = '/api/contracts/issueVersioned?id=' + encodeURIComponent(contractId);
            var issueContractId = issueForm.querySelector('input[name="contractId"]');
            if (issueContractId) {
                issueContractId.value = contractId;
                issueContractId.setAttribute('value', contractId);
            }
        }
        document.querySelectorAll('form[action="/api/contracts/removeDraft"]').forEach(function (removeForm) {
            if (!contractId) return;
            removeForm.action = '/api/contracts/removeDraft?id=' + encodeURIComponent(contractId);
            var removeContractId = removeForm.querySelector('input[name="contractId"]');
            if (removeContractId) {
                removeContractId.value = contractId;
                removeContractId.setAttribute('value', contractId);
            }
        });
        if (draftForm && !draftForm.dataset.summernoteBound) {
            draftForm.dataset.summernoteBound = '1';
            draftForm.addEventListener('submit', function () {
                var submittedContractId = new URLSearchParams(window.location.search).get('id');
                var submittedContractIdInput = draftForm.querySelector('input[name="contractId"]');
                if (submittedContractId && submittedContractIdInput) {
                    submittedContractIdInput.value = submittedContractId;
                    draftForm.action = '/api/contracts/updateDraft?id=' + encodeURIComponent(submittedContractId);
                }
                renumberDraft(draftBody);
                synchroniseEditor(draftBody);
            });
        }

        var libraryForm = document.getElementById('frmAddLibraryContractClause');
        var addLibraryButton = document.getElementById('btnAddLibraryContractClause');
        if (libraryForm && addLibraryButton && !addLibraryButton.dataset.clauseInsertBound) {
            addLibraryButton.dataset.clauseInsertBound = '1';
            addLibraryButton.addEventListener('click', function () {
                var select = libraryForm.querySelector('[name="clauseId"]');
                var serverConnect = document.getElementById('scContractClauses');
                var response = serverConnect && serverConnect.dmxComponent
                    ? serverConnect.dmxComponent.data.data || {}
                    : {};
                var clauses = Array.isArray(response.library) ? response.library : [];
                var clause = clauses.find(function (item) {
                    return String(item.id) === String(select.value);
                });
                if (!clause) return;
                insertClause(draftBody, clause.clauseName, mergeClauseFields(clause.clauseHtml, liveContractSnapshot()));
            });
        }

        var renumberButton = document.getElementById('renumberContractClauses');
        if (renumberButton && !renumberButton.dataset.renumberBound) {
            renumberButton.dataset.renumberBound = '1';
            renumberButton.addEventListener('click', function () {
                renumberDraft(draftBody);
            });
        }

        var refreshButton = document.getElementById('refreshAllContractData');
        if (refreshButton && !refreshButton.dataset.contractRefreshBound) {
            refreshButton.dataset.contractRefreshBound = '1';
            refreshButton.addEventListener('click', function () {
                var refreshed = mergeClauseFields(jQuery(draftBody).summernote('code'), liveContractSnapshot());
                jQuery(draftBody).summernote('code', refreshed);
                synchroniseEditor(draftBody);
                draftForm.requestSubmit();
            });
        }

        var customForm = document.getElementById('frmAddCustomContractClause');
        if (customForm && !customForm.dataset.clauseInsertBound) {
            customForm.dataset.clauseInsertBound = '1';
            var addCustomButton = document.getElementById('btnAddCustomContractClause');
            addCustomButton.addEventListener('click', function () {
                var heading = customForm.querySelector('[name="clauseHeading"]').value;
                var wording = customForm.querySelector('[name="clauseText"]').value;
                if (!heading.trim() || !wording.trim()) return;
                insertClause(draftBody, heading, escapeHtml(wording).replace(/\r?\n/g, '<br>'));
            });
        }

        document.querySelectorAll('.contract-draft-field').forEach(function (button) {
            if (button.dataset.summernoteBound) return;
            button.dataset.summernoteBound = '1';
            button.addEventListener('click', function () {
                if (!draftBody || !jQuery(draftBody).next('.note-editor').length) return;
                var token = String.fromCharCode(123, 123) + button.dataset.field + String.fromCharCode(125, 125);
                jQuery(draftBody).summernote('editor.insertText', token);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialiseDraftPage);
    } else {
        initialiseDraftPage();
    }

    // App Connect routing and data binding can add the editor after initial page load.
    window.setInterval(function () {
        if (document.getElementById('contractDraftBody')) initialiseDraftPage();
    }, 400);
}());

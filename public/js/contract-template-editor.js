(function () {
    var clauseLibrary = [];

    function renumberContract(html) {
        var container = document.createElement('div');
        container.innerHTML = html || '';
        var clauseIds = [];
        container.querySelectorAll('.contract-clause').forEach(function (clause, clauseIndex) {
            var clauseNumber = clauseIndex + 1;
            var id = clause.getAttribute('data-clause-id');
            if (id && clauseIds.indexOf(id) === -1) clauseIds.push(id);
            var headingNumber = clause.querySelector('.contract-clause-number');
            if (headingNumber) headingNumber.textContent = clauseNumber + '. ';
            clause.querySelectorAll('.contract-subclause-number').forEach(function (number) { number.remove(); });
            clause.querySelectorAll('.contract-clause-body > ol').forEach(function (list) {
                list.style.listStyle = 'none';
                list.style.paddingLeft = '1.5rem';
            });
            clause.querySelectorAll('.contract-clause-body > ol > li').forEach(function (item, itemIndex) {
                var number = document.createElement('span');
                number.className = 'contract-subclause-number';
                number.textContent = clauseNumber + '.' + (itemIndex + 1) + ' ';
                number.style.fontWeight = '600';
                item.insertBefore(number, item.firstChild);
            });
        });
        return { html: container.innerHTML, clauseIds: clauseIds };
    }

    function applyNumbering() {
        var editor = jQuery('#contractBody');
        if (!editor.length || !editor.next('.note-editor').length) return;
        var numbered = renumberContract(editor.summernote('code'));
        editor.summernote('code', numbered.html);
        var clauseIds = document.getElementById('contractClauseIds');
        if (clauseIds) clauseIds.value = numbered.clauseIds.join(',');
    }

    function loadClauseLibrary() {
        var select = document.getElementById('contractClauseSelect');
        if (!select || select.dataset.loaded || select.dataset.loading) return;
        select.dataset.loading = '1';
        window.fetch('/api/contracts/clauses', { credentials: 'same-origin' })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                clauseLibrary = (data.clauses || []).filter(function (clause) { return Number(clause.isActive) === 1; });
                var categories = {};
                clauseLibrary.forEach(function (clause) {
                    var category = clause.clauseCategory || 'Uncategorised';
                    if (!categories[category]) {
                        categories[category] = document.createElement('optgroup');
                        categories[category].label = category;
                        select.appendChild(categories[category]);
                    }
                    var option = document.createElement('option');
                    option.value = clause.id;
                    option.textContent = clause.clauseName;
                    categories[category].appendChild(option);
                });
                select.dataset.loaded = '1';
            })
            .catch(function (error) { window.console.error('Clause library could not load:', error); })
            .finally(function () { delete select.dataset.loading; });
    }

    function bindEditorControls() {
        document.querySelectorAll('.contract-field').forEach(function (button) {
            if (button.dataset.contractEditorBound) return;
            button.dataset.contractEditorBound = '1';
            button.addEventListener('click', function () {
                var token = String.fromCharCode(123, 123) + button.dataset.field + String.fromCharCode(125, 125);
                jQuery('#contractBody').summernote('editor.insertText', token);
            });
        });

        var form = document.getElementById('contractTemplateForm');
        if (form && !form.dataset.contractEditorBound) {
            form.dataset.contractEditorBound = '1';
            form.addEventListener('submit', function () {
                applyNumbering();
                jQuery('#contractBody').val(jQuery('#contractBody').summernote('code'));
            });
        }

        var insertClause = document.getElementById('insertContractClause');
        if (insertClause && !insertClause.dataset.contractEditorBound) {
            insertClause.dataset.contractEditorBound = '1';
            insertClause.addEventListener('click', function () {
                var select = document.getElementById('contractClauseSelect');
                var clause = clauseLibrary.find(function (item) { return String(item.id) === String(select.value); });
                if (!clause) return;
                var html = '<section class="contract-clause" data-clause-id="' + clause.id + '"><h2><span class="contract-clause-number"></span>' +
                    clause.clauseName.replace(/[&<>"']/g, function (character) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]; }) +
                    '</h2><div class="contract-clause-body">' + clause.clauseHtml + '</div></section><p><br></p>';
                jQuery('#contractBody').summernote('pasteHTML', html);
                applyNumbering();
            });
        }

        var previewButton = document.getElementById('previewContractButton');
        if (previewButton && !previewButton.dataset.contractEditorBound) {
            previewButton.dataset.contractEditorBound = '1';
            previewButton.addEventListener('click', function () {
                var workflowId = document.getElementById('contractPreviewWorkflow').value;
                if (!workflowId) return;
                window.location.href = '/contracts/preview?templateId=' + encodeURIComponent(previewButton.dataset.templateId) + '&workflowId=' + encodeURIComponent(workflowId);
            });
        }
    }

    function initialiseContractPage() {
        bindEditorControls();
        loadClauseLibrary();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialiseContractPage);
    } else {
        initialiseContractPage();
    }

    // Wappler routing swaps page content without firing DOMContentLoaded again.
    window.setInterval(function () {
        if (document.getElementById('contractBody')) initialiseContractPage();
    }, 500);
}());

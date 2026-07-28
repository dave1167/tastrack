(function () {
    function initialisePage() {
        var form = document.getElementById('contractClauseForm');
        if (form) {
            form.setAttribute('action', '/api/contracts/saveClauseAdvanced');
            form.removeAttribute('dmx-bind:action');
        }
        if (form && !form.dataset.editorBound) {
            form.dataset.editorBound = '1';
            form.addEventListener('submit', function () {
                jQuery('#clauseBody').val(jQuery('#clauseBody').summernote('code'));
            });
        }
        document.querySelectorAll('.contract-clause-field').forEach(function (button) {
            if (button.dataset.editorBound) return;
            button.dataset.editorBound = '1';
            button.addEventListener('click', function () {
                var editor = jQuery('#clauseBody');
                if (!editor.length || !editor.next('.note-editor').length) return;
                var token = String.fromCharCode(123, 123) + button.dataset.field + String.fromCharCode(125, 125);
                editor.summernote('editor.insertText', token);
                editor.summernote('focus');
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialisePage);
    else initialisePage();
    window.setInterval(function () { if (document.getElementById('clauseBody')) initialisePage(); }, 500);
}());

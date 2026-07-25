(function () {
    function initialiseClauseEditor() {
        if (!window.jQuery || !jQuery.fn.summernote) return;
        var editor = jQuery('#clauseBody');
        if (!editor.length || editor.next('.note-editor').length) return;
        var editingExisting = new URLSearchParams(window.location.search).has('id');
        if (editingExisting && !editor.val()) return;
        editor.summernote({
            height: 420,
            tooltip: false,
            placeholder: 'Write the reusable clause wording here…',
            toolbar: [
                ['style', ['style']],
                ['font', ['bold', 'italic', 'underline', 'clear']],
                ['para', ['ul', 'ol', 'paragraph']],
                ['insert', ['link', 'table', 'hr']],
                ['view', ['codeview']]
            ]
        });
    }

    function initialisePage() {
        try { initialiseClauseEditor(); } catch (error) { window.console.error('Clause editor could not initialise:', error); }
        var form = document.getElementById('contractClauseForm');
        if (form && !form.dataset.editorBound) {
            form.dataset.editorBound = '1';
            form.addEventListener('submit', function () {
                jQuery('#clauseBody').val(jQuery('#clauseBody').summernote('code'));
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialisePage);
    else initialisePage();
    window.setInterval(function () { if (document.getElementById('clauseBody')) initialisePage(); }, 500);
}());

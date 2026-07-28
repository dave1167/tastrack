(function () {
    function repairSummernoteDropdowns(root) {
        if (!window.bootstrap || !bootstrap.Dropdown) return;
        var scope = root || document;
        var toggles = Array.from(scope.querySelectorAll('.note-editor [data-toggle="dropdown"]'));
        if (scope.matches && scope.matches('.note-editor [data-toggle="dropdown"]')) toggles.unshift(scope);
        toggles.forEach(function (toggle) {
            toggle.removeAttribute('data-toggle');
            toggle.setAttribute('data-bs-toggle', 'dropdown');
            bootstrap.Dropdown.getOrCreateInstance(toggle);
        });
    }

    function start() {
        repairSummernoteDropdowns(document);
        new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) repairSummernoteDropdowns(node);
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
}());

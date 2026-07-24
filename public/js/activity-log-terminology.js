(async function () {
    const select = document.querySelector('#content select[name="category"]');
    if (!select) return;

    const selected = new URLSearchParams(window.location.search).get('category') || '';
    let terms = {
        workflowPlural: 'Workflows',
        stagePlural: 'Stages',
        taskPlural: 'Tasks',
        locationPlural: 'Locations',
        spacePlural: 'Spaces',
        configurationPlural: 'Configurations'
    };

    try {
        const response = await fetch('/api/settings/terminology', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });
        const payload = await response.json();
        if (payload.query && payload.query[0]) {
            terms = Object.assign(terms, payload.query[0]);
        }
    } catch (error) {
        // Keep the standard labels when terminology cannot be loaded.
    }

    const categories = [
        ['', 'All categories'],
        ['workflow', terms.workflowPlural],
        ['stage', terms.stagePlural],
        ['task', terms.taskPlural],
        ['locations', terms.locationPlural + ', ' + terms.spacePlural + ' & ' + terms.configurationPlural],
        ['contact', 'Contacts'],
        ['document', 'Documents'],
        ['users', 'Users'],
        ['template', 'Templates'],
        ['security', 'Security'],
        ['system', 'System'],
        ['import', 'Imports'],
        ['record', 'Records']
    ];

    select.replaceChildren();
    categories.forEach(function (category) {
        select.add(new Option(category[1], category[0], false, category[0] === selected));
    });
})();

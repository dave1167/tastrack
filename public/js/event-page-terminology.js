(async function () {
    let terms = {
        workflowSingular: 'Workflow',
        workflowPlural: 'Workflows',
        locationSingular: 'Location',
        spaceSingular: 'Space',
        configurationSingular: 'Configuration'
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
        // Standard labels remain available if the terminology request fails.
    }

    const locationHeading = document.querySelector(
        '#eventInfoSummary > .row > .col-12 .small.text-muted'
    );
    if (locationHeading) locationHeading.textContent = terms.locationSingular;

    const labelMap = [
        ['label[for="eventLocationId"]', terms.locationSingular],
        ['label[for="eventSpaceId"]', terms.spaceSingular],
        ['label[for="eventConfigurationId"]', terms.configurationSingular]
    ];
    labelMap.forEach(function (entry) {
        const label = document.querySelector(entry[0]);
        if (label) label.textContent = entry[1];
    });

    const placeholderMap = [
        ['#eventLocationId option[value=""]', 'No ' + terms.locationSingular.toLowerCase() + ' selected'],
        ['#eventSpaceId option[value=""]', 'No ' + terms.spaceSingular.toLowerCase() + ' selected'],
        ['#eventConfigurationId option[value=""]', 'No ' + terms.configurationSingular.toLowerCase() + ' selected']
    ];
    placeholderMap.forEach(function (entry) {
        const option = document.querySelector(entry[0]);
        if (option) option.textContent = entry[1];
    });

    const saveButton = document.querySelector(
        '#editEventLocation button[type="submit"]'
    );
    if (saveButton) {
        saveButton.textContent = 'Save ' + terms.locationSingular.toLowerCase();
    }

    document.querySelector('nav[aria-label="Event sections"]')
        ?.setAttribute('aria-label', terms.workflowSingular + ' sections');
})();

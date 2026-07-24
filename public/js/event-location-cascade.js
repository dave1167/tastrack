(function () {
    if (window.eventLocationCascadeInstalled) return;
    window.eventLocationCascadeInstalled = true;

    function resetSelect(select, label) {
        if (!select) return;
        select.replaceChildren(new Option(label, ''));
        select.value = '';
    }

    async function loadOptions(url, select, placeholder, labelField) {
        resetSelect(select, placeholder);
        if (!select) return;

        select.disabled = true;
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) throw new Error('Unable to load options');

            const payload = await response.json();
            const rows = payload.query || [];
            rows.forEach(function (row) {
                select.add(new Option(row[labelField], row.id));
            });
        } catch (error) {
            resetSelect(select, 'Unable to load options');
        } finally {
            select.disabled = false;
        }
    }

    document.addEventListener('change', function (event) {
        const locationSelect = event.target.closest('#eventLocationId');
        const spaceSelect = event.target.closest('#eventSpaceId');
        const configurationSelect = document.querySelector('#eventConfigurationId');
        const workflowId = new URLSearchParams(window.location.search).get('id') || '0';

        if (locationSelect) {
            event.stopImmediatePropagation();
            resetSelect(configurationSelect, 'No configuration selected');
            configurationSelect.disabled = true;

            const targetSpace = document.querySelector('#eventSpaceId');
            if (!locationSelect.value) {
                resetSelect(targetSpace, 'No space selected');
                targetSpace.disabled = true;
                return;
            }

            loadOptions(
                '/api/locations/spaceOptions?locationid=' +
                    encodeURIComponent(locationSelect.value) +
                    '&workflowid=' + encodeURIComponent(workflowId),
                targetSpace,
                'No space selected',
                'spaceLabel'
            );
            return;
        }

        if (spaceSelect) {
            event.stopImmediatePropagation();
            if (!spaceSelect.value) {
                resetSelect(configurationSelect, 'No configuration selected');
                configurationSelect.disabled = true;
                return;
            }

            loadOptions(
                '/api/locations/configurationOptions?spaceid=' +
                    encodeURIComponent(spaceSelect.value) +
                    '&workflowid=' + encodeURIComponent(workflowId),
                configurationSelect,
                'No configuration selected',
                'configurationLabel'
            );
        }
    }, true);
})();

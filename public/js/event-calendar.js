(function () {
    'use strict';

    function loadCalendar() {
        document.getElementById('calendarApplyFilters').dispatchEvent(new Event('click', {bubbles: true}));
    }

    document.getElementById('calendarApplyFilters').addEventListener('click', loadCalendar);
    document.getElementById('calendarSearch').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            loadCalendar();
        }
    });
    document.getElementById('calendarClearFilters').addEventListener('click', function () {
        ['calendarSearch', 'calendarWorkflow', 'calendarLocation', 'calendarTeam', 'calendarStatus'].forEach(function (id) {
            const element = document.getElementById(id);
            element.value = '';
            element.dispatchEvent(new Event('change', {bubbles: true}));
        });
        document.querySelectorAll('#calendarDateTypes input').forEach(function (input) {
            input.checked = input.value !== 'completion';
            input.dispatchEvent(new Event('change', {bubbles: true}));
        });
        loadCalendar();
    });

})();

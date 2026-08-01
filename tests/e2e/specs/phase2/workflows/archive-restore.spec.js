const { test } = require('../../../fixtures/meldren');

test.describe('Phase 2 workflow archive and deletion', () => {
    test('P2-24 archive a workflow and retain its relationships', async () => {
        test.skip(true, 'No workflow archive Server Connect action or archived-workflow view exists.');
    });
    test('P2-25 restore an archived workflow', async () => {
        test.skip(true, 'No workflow restore action exists because workflow archiving is not yet implemented.');
    });
    test('P2-26 direct permanent workflow deletion is protected', async () => {
        test.skip(true, 'No workflow permanent-delete endpoint exists; Phase 1 and Phase 2 direct-access tests verify that no alternative mutation endpoint can delete it.');
    });
});

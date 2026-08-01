const { seedTestData } = require('./seed-test-data');

module.exports = async function globalSetup() {
    await seedTestData();
};

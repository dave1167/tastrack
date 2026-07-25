const BreakError = require('../../../lib/errors/breakError');

module.exports = {
    require: async function (options) {
        const moduleCode = this.parseRequired(options.moduleCode, 'string', 'tenantModule.require: moduleCode is required.');
        const tenantId = this.parseOptional(options.tenantId, 'number', 0);
        const userId = this.parseOptional(options.userId, 'number', 0);
        const db = this.getDbConnection('db');

        const entitlement = await db('tbl_tenant_modules as tm')
            .innerJoin('tbl_modules as m', 'm.id', 'tm.moduleId')
            .innerJoin('tbl_user_tenant_roles as utr', function () {
                this.on('utr.tenantId', 'tm.tenantId').andOnVal('utr.userId', userId).andOnVal('utr.isActive', 1);
            })
            .where('tm.tenantId', tenantId)
            .where('m.moduleCode', moduleCode)
            .where('m.isActive', 1)
            .where(function () {
                this.where('tm.status', 'ACTIVE').orWhere(function () {
                    this.where('tm.status', 'TRIAL').where(function () {
                        this.whereNull('tm.trialEndsDate').orWhere('tm.trialEndsDate', '>', db.fn.now());
                    });
                });
            })
            .where(function () {
                this.whereNull('tm.accessStartDate').orWhere('tm.accessStartDate', '<=', db.fn.now());
            })
            .where(function () {
                this.whereNull('tm.accessEndDate').orWhere('tm.accessEndDate', '>', db.fn.now());
            })
            .select('tm.id as tenantModuleId', 'tm.status', 'm.moduleCode', 'm.moduleName')
            .first();

        if (!entitlement) {
            this.res.status(403).json({
                success: false,
                errorCode: 'MODULE_NOT_ENABLED',
                message: `${moduleCode.replaceAll('_', ' ')} is not enabled for this organisation.`,
                moduleCode
            });
            throw new BreakError();
        }

        return entitlement;
    }
};

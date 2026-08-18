const BreakError = require('../../../lib/errors/breakError');

function denial(tenant) {
    if (tenant.lifecycleStatus === 'closed') return ['TENANT_CLOSED', 'This organisation is closed and cannot make changes.'];
    if (tenant.lifecycleStatus === 'suspended') return ['TENANT_SUSPENDED', 'This organisation is suspended and cannot make changes.'];
    if (tenant.lifecycleStatus === 'read_only') return ['TENANT_READ_ONLY', 'This workspace is available for review only.'];
    if (tenant.lifecycleStatus === 'expired') return [tenant.tenantType === 'demo' ? 'DEMO_EXPIRED' : 'TENANT_EXPIRED', tenant.tenantType === 'demo' ? 'This demo has ended.' : 'This organisation has expired.'];
    if (tenant.accessStartDate && new Date(tenant.accessStartDate) > new Date()) return ['TENANT_ACCESS_NOT_STARTED', 'Access to this organisation has not started.'];
    if (tenant.accessEndDate && new Date(tenant.accessEndDate) <= new Date()) return [tenant.tenantType === 'demo' ? 'DEMO_EXPIRED' : tenant.tenantType === 'trial' ? 'TRIAL_EXPIRED' : 'TENANT_EXPIRED', tenant.tenantType === 'demo' ? 'This demo has ended.' : tenant.tenantType === 'trial' ? 'This trial has ended and is available for review only.' : 'Access to this organisation has expired.'];
    return ['TENANT_WRITE_BLOCKED', 'This organisation is not currently permitted to make changes.'];
}

async function decision(db, tenantId) {
        const tenant = await db('tbl_tenants').where({id: tenantId}).first('id','tenantType','lifecycleStatus','accessStartDate','accessEndDate','isActive');
        const allowed = Boolean(tenant && Number(tenant.isActive) === 1 && tenant.lifecycleStatus === 'active' && (!tenant.accessStartDate || new Date(tenant.accessStartDate) <= new Date()) && (!tenant.accessEndDate || new Date(tenant.accessEndDate) > new Date()));
        const [errorCode, message] = allowed ? [null, null] : tenant ? denial(tenant) : ['TENANT_CONTEXT_INVALID', 'Organisation access could not be verified.'];
        return {allowed, tenant, errorCode, message};
}

async function requireWrite(app, tenantId, userId = 0, requireMembership = true) {
        const db = app.getDbConnection('db');
        const result = await decision(db, tenantId);
        let allowed = result.allowed;
        if (allowed && requireMembership) {
            allowed = Boolean(userId && await db('tbl_user_tenants').where({tenantId,userId,actorType:'human',isActive:1,membershipStatus:'active'}).first('id'));
        }
        if (!allowed) {
            const errorCode = result.allowed ? 'TENANT_MEMBERSHIP_INVALID' : result.errorCode;
            const message = result.allowed ? 'Organisation membership could not be verified.' : result.message;
            app.res.status(403).json({success:false,errorCode,message});
            throw new BreakError();
        }
        return {tenantId,tenantType:result.tenant.tenantType,lifecycleStatus:result.tenant.lifecycleStatus,canWrite:true};
}

module.exports = {
    requireWrite: async function (options) {
        const tenantId = this.parseRequired(options.tenantId, 'number', 'tenantLifecycle.requireWrite: tenantId is required.');
        const userId = this.parseOptional(options.userId, 'number', 0);
        const requireMembership = this.parseOptional(options.requireMembership, 'boolean', true);
        return requireWrite(this, tenantId, userId, requireMembership);
    },
    _requireWrite: requireWrite,
    _decision: decision
};

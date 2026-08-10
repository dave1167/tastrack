exports.up = async function (knex) {
  await knex.raw(`
    INSERT INTO tbl_tenant_terminology
      (tenantId, termKey, singularLabel, pluralLabel)
    SELECT tenant.id, 'stage', 'Phase', 'Phases'
    FROM tbl_tenants tenant
    WHERE NOT EXISTS (
      SELECT 1
      FROM tbl_tenant_terminology terminology
      WHERE terminology.tenantId = tenant.id
        AND terminology.termKey = 'stage'
    )
  `);
};

exports.down = async function () {
  // Existing terminology is tenant-owned configuration and is not removed.
};

const LEGACY_ALIASES = {
  'commercial.availableFrom': 'on_sale_datetime',
  'commercial.currencyCode': 'currency_code',
  'commercial.capacity': 'complimentary_allocation',
  'commercial.salesTarget': 'guarantee',
  'commercial.taxNotes': 'settlement_notes',
  'commercial.notes': 'ticketing_notes',
  'commercial.priceList': 'ticket_prices'
};

const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parseJson = value => { if (value == null || value === '') return null; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch (_) { return null; } };

function rawValue(row) {
  for (const column of ['valueText','valueNumber','valueDecimal','valueDate','valueDateTime','valueTime','valueBoolean','valueJson']) if (row[column] !== null && row[column] !== undefined) return column === 'valueJson' ? parseJson(row[column]) : row[column];
  return '';
}

function displayValue(field, row) {
  const value = rawValue(row);
  if (Array.isArray(value) && field.fieldType === 'repeatable_table') {
    const columns = field.repeatableColumns || [];
    if (!value.length) return '';
    return `<table><thead><tr>${columns.map(column=>`<th>${escapeHtml(column.columnLabel)}</th>`).join('')}</tr></thead><tbody>${value.map(item=>`<tr>${columns.map(column=>`<td>${escapeHtml(item?.[column.columnKey] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  if (Array.isArray(value)) return value.map(escapeHtml).join(', ');
  if (field.fieldType === 'yes_no' || field.fieldType === 'checkbox') return Number(value) ? 'Yes' : 'No';
  if (field.fieldType === 'currency' && value !== '') return Number(value).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
  if (field.fieldType === 'percentage' && value !== '') return `${Number(value).toLocaleString('en-GB',{maximumFractionDigits:2})}%`;
  return escapeHtml(value);
}

async function merge(db, tenantId, workflowId, html) {
  const fields = await db('tbl_form_fields as f').join('tbl_record_form_values as v',function(){this.on('v.formFieldId','f.id').andOn('v.tenantId','f.tenantId');}).where({'v.tenantId':tenantId,'v.workflowId':workflowId,'f.isActive':1}).select('f.id','f.fieldKey','f.fieldType','v.valueText','v.valueNumber','v.valueDecimal','v.valueDate','v.valueDateTime','v.valueTime','v.valueBoolean','v.valueJson');
  const ids=fields.map(field=>field.id),columns=ids.length?await db('tbl_form_repeatable_columns').where({tenantId,isActive:1}).whereIn('formFieldId',ids).orderBy('displayOrder').orderBy('id'):[];
  const values={};
  for(const field of fields){field.repeatableColumns=columns.filter(column=>column.formFieldId===field.id);values[field.fieldKey]=displayValue(field,field);}
  let rendered=String(html||'');
  for(const [fieldKey,value] of Object.entries(values)) for(const token of [`{{form.${fieldKey}}}`,`{{commercial.${fieldKey}}}`]) rendered=rendered.split(token).join(value);
  for(const [token,fieldKey] of Object.entries(LEGACY_ALIASES)) rendered=rendered.split(`{{${token}}}`).join(values[fieldKey] ?? (token==='commercial.currencyCode'?'GBP':''));
  return rendered;
}

async function tenantContext(app) {
  const tenantId=Number(app.req.session?.TENANT_ID),userId=Number(app.req.session?.USER_ID),db=app.getDbConnection('db');
  if(!tenantId||!userId) throw Object.assign(new Error('Authentication required.'),{status:401});
  const member=await db('tbl_user_tenants').where({tenantId,userId,isActive:1,membershipStatus:'active'}).first('id');
  if(!member) throw Object.assign(new Error('Tenant access denied.'),{status:403});
  return {tenantId,db};
}

module.exports={
  async preview(){const c=await tenantContext(this),o=this.options||{},workflowId=Number(o.workflowId),workflow=await c.db('tbl_workflows').where({id:workflowId,tenantId:c.tenantId}).first('id');if(!workflow)return[];return[{templateId:Number(o.templateId),workflowId,templateName:o.templateName||'',workflowName:o.workflowName||'',renderedHtml:await merge(c.db,c.tenantId,workflowId,o.baseHtml)}];},
  async mergeGenerated(){const c=await tenantContext(this),contractId=Number(this.options?.contractId),contract=await c.db('tbl_generated_contracts').where({id:contractId,tenantId:c.tenantId}).first('id','workflowId','renderedHtml');if(!contract)throw Object.assign(new Error('Contract not found.'),{status:404});const renderedHtml=await merge(c.db,c.tenantId,contract.workflowId,contract.renderedHtml);await c.db('tbl_generated_contracts').where({id:contract.id,tenantId:c.tenantId}).update({renderedHtml});return{success:true};},
  _test:{displayValue,merge,LEGACY_ALIASES}
};

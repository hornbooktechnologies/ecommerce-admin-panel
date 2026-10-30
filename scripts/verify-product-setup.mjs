import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '../../ecommerce-frontend/node_modules/@playwright/test/index.mjs';
const output=fileURLToPath(new URL('../coverage/product-setup/',import.meta.url));await mkdir(output,{recursive:true});
const tid='018f47f2-6b6d-7c34-ae31-8f4f17b79b79',pid='018f47f2-6b6d-7c34-ae31-8f4f17b79b80';
const permissions=['catalog.product.read','catalog.product.create','catalog.product.update','inventory.stock.manage'];
const user={id:pid,firstName:'Setup',lastName:'Review',displayName:'Setup Review',areas:['admin'],defaultArea:'admin',assignments:[{roleLevel:'TENANT',tenantId:tid,tenantName:'Hornbook Retail',scopeId:tid,scopeType:'TENANT',roleName:'Tenant owner',permissions}],ui:{navigation:{admin:{[tid]:[{href:'/admin/catalog/products',label:'Catalog',icon:'catalog'},{href:'/admin/inventory',label:'Inventory',icon:'inventory'}]}},capabilities:{admin:{[tid]:permissions}}}};
const lookups={productTypes:[{vertical:'CLOTHING',name:'Clothing'}],units:[{id:'ea',code:'EA',name:'Each'},{id:'kg',code:'KG',name:'Kilogram'}],colors:[{id:'blue',name:'Blue',value:'BLUE',swatchValue:'#2255aa'}],sizes:[{id:'m',name:'M',value:'M'},{id:'l',name:'L',value:'L'}],categories:[{id:'cat',name:'Clothing'}],brands:[{id:'brand',name:'Hornbook'}],taxCategories:[{id:'gst',name:'GST 5%'}]};
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],created=[];let uploads=0,failUpload=true,failCreate=false;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(tid=>{localStorage.setItem('commerce-theme','dark');localStorage.setItem('commerce.activeTenantId',tid);},tid);
 await context.route('http://localhost:4000/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data={};
  if(url.pathname.endsWith('/auth/refresh'))data={accessToken:'setup-isolated-test',user};
  else if(url.pathname.endsWith('/unread-count'))data={unreadCount:0};
  else if(url.pathname.endsWith('/catalog/lookups'))data=lookups;
  else if(url.pathname.endsWith('/catalog/products')){
   if(req.method()==='POST'){
    if(failCreate){failCreate=false;return route.fulfill({status:409,json:{error:{message:'Product code already exists.'}}});}
    created.push(req.postDataJSON());data={product:{id:pid}};
   }else data={items:[],summary:{total:0,published:0,draft:0,pending:0},page:1,pageSize:10,total:0,totalPages:1};
  }else if(url.pathname.includes('/media/upload')){
   uploads++;if(failUpload){failUpload=false;return route.fulfill({status:503,json:{error:{message:'Upload temporarily unavailable.'}}});}data={id:pid};
  }
  return route.fulfill({json:{data}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
 const dialog=page.getByRole('dialog',{name:'Add a product'}), next=()=>dialog.getByRole('button',{name:'Continue',exact:true}).click();
 async function open(theme='dark'){await page.goto('http://localhost:3000/admin/catalog/products');await expect(page.getByRole('button',{name:'New product',exact:true})).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');if(theme==='light')await page.getByRole('button',{name:'Switch to light theme'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await page.getByRole('button',{name:'New product',exact:true}).click();await expect(dialog).toBeVisible();}
 async function basics(code='COTTON-01'){await dialog.getByLabel('Product code',{exact:false}).fill(code);await dialog.getByLabel('Product name',{exact:false}).fill('Cotton trouser');await next();}
 async function standardPrice(){await dialog.getByLabel('Standard MRP',{exact:true}).fill('1500');await dialog.getByLabel('Standard selling price',{exact:true}).fill('1200');}
 await open();await next();await expect(dialog.getByRole('alert')).toBeFocused();await expect(dialog.locator('[aria-invalid=true]')).toHaveCount(2);
 await dialog.getByRole('alert').getByRole('button').first().click();await expect(dialog.getByLabel('Product code',{exact:false})).toBeFocused();
 await basics();await expect(dialog.getByRole('heading',{name:'Choose variants and prices'})).toBeFocused();
 await dialog.getByRole('button',{name:'Blue',exact:true}).click();await dialog.getByRole('button',{name:'M',exact:true}).click();await dialog.getByRole('button',{name:'L',exact:true}).click();
 await dialog.getByLabel('Bulk MRP',{exact:true}).fill('1500');await dialog.getByLabel('Bulk selling price',{exact:true}).fill('1200');await dialog.getByRole('button',{name:'Apply to all',exact:true}).click();
 await dialog.getByLabel('Blue / L selling price',{exact:true}).fill('1700');await next();await expect(dialog.getByRole('alert')).toContainText('selling price cannot exceed MRP');
 await dialog.getByLabel('Blue / L selling price',{exact:true}).fill('1300');await next();
 await dialog.locator('input[type=file]').setInputFiles({name:'product.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVxkAAAAASUVORK5CYII=','base64')});
 await expect(dialog.getByText('Primary · Ready to upload')).toBeVisible();await next();await expect(dialog.getByText('Published does not mean available')).toBeVisible();await next();
 assert.equal(created.length,0,'No write before review');await expect(dialog.getByText('Draft — not published',{exact:true})).toBeVisible();
 await page.screenshot({path:`${output}/review-dark.png`});
 await dialog.getByRole('button',{name:/^1\s*Basics$/}).click();await expect(dialog.getByLabel('Product name',{exact:false})).toHaveValue('Cotton trouser');
 await dialog.getByRole('button',{name:/^5\s*Review$/}).click();await dialog.getByRole('button',{name:'Create draft',exact:true}).click();
 await expect(dialog.getByRole('heading',{name:'Draft saved — images need attention'})).toBeVisible();assert.equal(created.length,1);assert.equal(uploads,1);
 await expect(dialog.getByRole('button',{name:/^1\s*Basics$/})).toBeDisabled();await dialog.getByRole('button',{name:'Retry remaining images'}).click();
 await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'Cotton trouser was saved as a draft'})).toBeVisible();assert.equal(created.length,1);assert.equal(uploads,2);assert.equal(created[0].variants.length,2);assert.deepEqual(created[0].variants.map(v=>v.pricing.salePrice),[1200,1300]);assert.equal(created[0].productKind,'STANDARD');
 // Bundle and failed create preserve all entered values without claiming stock exists.
 await open();await dialog.getByLabel('Product structure').selectOption('BUNDLE');await basics('BUNDLE-01');await standardPrice();await next();await next();await expect(dialog.getByText('Bundle stock comes from its components')).toBeVisible();await next();
 failCreate=true;await dialog.getByRole('button',{name:'Create draft',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Product code already exists');assert.equal(created.length,1);
 await dialog.getByRole('button',{name:/^1\s*Basics$/}).click();await dialog.getByLabel('Product code',{exact:false}).fill('BUNDLE-02');await dialog.getByRole('button',{name:/^5\s*Review$/}).click();await dialog.getByRole('button',{name:'Create draft',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(created[1].productKind,'BUNDLE');
 // Type gating and required grocery weight step.
 lookups.productTypes=[{vertical:'GROCERY',name:'Grocery'},{vertical:'ELECTRONICS',name:'Electronics'}];await open();await expect(dialog.getByRole('button',{name:/Clothing.*exchange/})).toHaveCount(0);await basics('APPLE-01');await standardPrice();await next();await expect(dialog.getByRole('alert')).toContainText('Weight step');await dialog.getByLabel('Weight step kg').fill('0.1');await next();await expect(dialog.getByRole('heading',{name:'Show the product clearly'})).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 lookups.productTypes=[{vertical:'ELECTRONICS',name:'Electronics'}];await open();
 await dialog.locator('summary').click();await dialog.getByRole('button',{name:'Add custom field'}).click();await dialog.getByLabel('Field name',{exact:false}).fill('Screen size');
 await basics('SCREEN-01');await expect(dialog.getByRole('alert')).toContainText('Value');
 await dialog.locator('.custom-field-value input').fill('14 inch');await next();await standardPrice();await dialog.getByLabel('Warranty months').fill('24');await next();await next();await next();await dialog.getByRole('button',{name:'Create draft',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(created[2].variants[0].warrantyMonths,24);assert.equal(created[2].customFields[0].value,'14 inch');
 // Responsive controls, themes, native focus loop, no page overflow.
 lookups.productTypes=[{vertical:'CLOTHING',name:'Clothing'}];
 for(const [width,height,theme] of [[375,812,'dark'],[768,1024,'light'],[844,390,'dark'],[1440,1000,'light']]){
  await page.setViewportSize({width,height});await open(theme);
  await page.screenshot({path:`${output}/basics-${width}-${theme}.png`});
  for(let i=0;i<20;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(node=>node.contains(document.activeElement)));}
  const bounds=await dialog.boundingBox(),clientWidth=await page.evaluate(()=>document.documentElement.clientWidth);assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=clientWidth+1&&bounds.y+bounds.height<=height+1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await dialog.getByRole('button',{name:'Continue',exact:true}).click({trial:true});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'New product',exact:true})).toBeFocused();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,createdPayloads:created.length,uploadRetryWithoutDuplicate:true,verticalGating:true,responsive:[375,768,844,1440],consoleErrors:errors.length}));
}finally{await browser.close()}

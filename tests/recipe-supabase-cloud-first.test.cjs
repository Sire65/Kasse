const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const recipe=fs.readFileSync(path.join(root,'pc-manager/recipe-manager.js'),'utf8');
assert.match(recipe,/const VERSION='0\.2\.1'/);
assert.match(recipe,/PENDING_DATA_STORE='kcm_recipes_pending_payloads_v2'/);
assert.match(recipe,/PRECLOUD_BACKUP_STORE='kcm_recipes_precloud_backup_v1'/);
assert.match(recipe,/const startupStoredRecipes=readStore\(\)\.map/);
assert.match(recipe,/const original=startupStoredRecipes\.find/);
assert.match(recipe,/recipes:startupStoredRecipes/);
assert.match(recipe,/savePreCloudBackup\(\);\s*capturePendingFromLocal\(\);[\s\S]{0,300}await pullAll\(\)/);
assert.doesNotMatch(recipe,/initializeCloud\(\)[\s\S]{0,800}await flushPending\(\)/);
assert.doesNotMatch(recipe,/if\(!recipes\.length&&before\.length\)[\s\S]{0,400}pushRecipe/);
assert.match(recipe,/if\(!cloudReady\)return status\(/);
assert.match(recipe,/recipePendingReview/);
assert.match(recipe,/Supabase wurde NICHT verändert/);

const serving=fs.readFileSync(path.join(root,'pc-manager/recipe-serving-materials-supabase.js'),'utf8');
assert.match(serving,/if\(Array\.isArray\(mats\)\)write\(MATERIAL_STORE,mats\.map\(fromDb\)\)/);
assert.doesNotMatch(serving,/Array\.isArray\(mats\)&&mats\.length/);

console.log('Supabase-first Schutz: Cloud wird zuerst gelesen, Pending bleibt lokal erhalten, kein Start-Upload.');

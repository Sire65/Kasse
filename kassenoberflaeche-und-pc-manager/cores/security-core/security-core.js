(()=>{
"use strict";
const VERSION="0.2.0";
const ROLES=Object.freeze(["cashier","shiftlead","manager","admin","superadmin"]);
const DEFAULT_GRANTS=Object.freeze({
 cashier:["sale.create","cart.edit","product.info.read"],
 shiftlead:["sale.create","cart.edit","product.info.read","receipt.park","receipt.cancel","discount.apply","cash.withdraw"],
 manager:["sale.create","cart.edit","product.info.read","receipt.park","receipt.cancel","discount.apply","cash.withdraw","reports.read","catalog.edit","inventory.adjust","product.info.approve","closing.execute"],
 admin:["sale.create","cart.edit","product.info.read","receipt.park","receipt.cancel","discount.apply","cash.withdraw","reports.read","catalog.edit","inventory.adjust","product.info.approve","closing.execute","users.manage","settings.manage","audit.read"],
 superadmin:["*"]
});
const clone=v=>JSON.parse(JSON.stringify(v));
function normalizeRole(role){return ROLES.includes(role)?role:"cashier"}
function normalizePolicy(policy={}){const grants={};for(const role of ROLES){grants[role]=Array.from(new Set([...(DEFAULT_GRANTS[role]||[]),...((policy.grants&&policy.grants[role])||[])])).filter(Boolean)}return{version:VERSION,grants,stepUp:Array.from(new Set(policy.stepUp||["receipt.cancel","cash.withdraw","inventory.adjust","users.manage","settings.manage","protected.open"])),reasonRequired:Array.from(new Set(policy.reasonRequired||["receipt.cancel","cash.withdraw","inventory.adjust"]))}}
function has(permission,ctx={}){const policy=normalizePolicy(ctx.policy),role=normalizeRole(ctx.role),session=ctx.session;if(!session||session.valid===false)return false;const list=policy.grants[role]||[];return list.includes("*")||list.includes(permission)}
function decision(permission,ctx={}){const allowed=has(permission,ctx),policy=normalizePolicy(ctx.policy);return{allowed,permission,role:normalizeRole(ctx.role),requiresStepUp:allowed&&policy.stepUp.includes(permission),requiresReason:allowed&&policy.reasonRequired.includes(permission),code:allowed?"ALLOW":"DENY"}}
function guard(permission,ctx={},onDenied){const d=decision(permission,ctx);if(!d.allowed){try{onDenied&&onDenied(d)}catch{}return false}return true}
window.KCSecurityCore=Object.freeze({VERSION,ROLES,DEFAULT_GRANTS,normalizeRole,normalizePolicy,has,decision,guard,capabilities:()=>({roles:[...ROLES],permissions:[...new Set(Object.values(DEFAULT_GRANTS).flat())],denyByDefault:true,directInvocationProtected:true})});
})();

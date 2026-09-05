(() => {
'use strict';
const BASE = new URL('.', document.currentScript.src);
let manifestPromise;

async function getManifest(){
  if(!manifestPromise){
    manifestPromise = fetch(new URL('avatar-manifest.json', BASE))
      .then(r => { if(!r.ok) throw new Error('Avatar-Manifest nicht verfügbar'); return r.json(); });
  }
  return manifestPromise;
}
function absolute(path){ return new URL(path, BASE).href; }

window.AvatarCore = {
  version: '0.1.0-candidate',
  async getProfile(role='chef', gender='female'){
    const m = await getManifest();
    const roleData = m.roles?.[role];
    if(!roleData || roleData.status) throw new Error(`Avatarrolle ${role} ist noch nicht freigegeben.`);
    const p = roleData[gender] || roleData.female || roleData.male;
    return {
      ...p,
      default: absolute(p.default),
      states: Object.fromEntries(Object.entries(p.states || {}).map(([k,v]) => [k, absolute(v)]))
    };
  },
  async apply(img, {role='chef', gender='female', state='neutral'}={}){
    const p = await this.getProfile(role, gender);
    img.src = p.states[state] || p.default;
    img.alt = `${p.name} – ${p.title}`;
    img.dataset.avatarRole = role;
    img.dataset.avatarGender = gender;
    img.dataset.avatarState = state;
    return p;
  },
  async setState(img, state='neutral'){
    return this.apply(img, {
      role: img.dataset.avatarRole || 'chef',
      gender: img.dataset.avatarGender || 'female',
      state
    });
  }
};
})();
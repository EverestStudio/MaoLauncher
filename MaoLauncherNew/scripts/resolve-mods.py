import requests,json,time
api='https://api.modrinth.com/v2/'
def get(p,params=None):
 for i in range(3):
  r=requests.get(api+p,params=params,timeout=45)
  if r.ok:return r.json()
  time.sleep(1)
 r.raise_for_status()
slugs=['fabric-api','emotecraft','entity-model-features','entitytexturefeatures','iris','journeymap','litematica','malilib','modmenu','placeholder-api','player-animation-library','sodium','simple-voice-chat']
selected={};pins={};titles={}
def choose(project,version=None):
 p=get('project/'+project);pid=p['id'];titles[pid]=p['title']
 if pid in selected and (not version or selected[pid]['id']==version):return
 if version:v=get('version/'+version)
 else:
  vs=get('project/'+pid+'/version',{'loaders':'["fabric"]','game_versions':'["26.2"]'})
  if not vs:raise Exception('Нет совместимой версии: '+p['title'])
  v=next((x for x in vs if x['version_type']=='release'),vs[0])
 if '26.2' not in v['game_versions'] or 'fabric' not in v['loaders']:raise Exception('Несовместимо '+p['title'])
 selected[pid]=v
 for d in v['dependencies']:
  if d['dependency_type']=='required':
   dp=d['project_id']
   if not dp:dp=get('version/'+d['version_id'])['project_id']
   if d['version_id']:pins[dp]=d['version_id']
   choose(dp,d['version_id'])
for slug in slugs:
 p=get('project/'+slug);choose(p['id'],pins.get(p['id']))
mods=[]
for pid,v in selected.items():
 f=next((f for f in v['files'] if f['primary']),v['files'][0]);mods.append({'project':pid,'name':titles[pid],'version':v['version_number'],'versionId':v['id'],'file':f['filename'],'url':f['url'],'size':f['size'],'sha512':f['hashes']['sha512']})
json.dump({'minecraft':'26.2','loader':'fabric','mods':mods},open('mods-manifest.json','w'),indent=2,ensure_ascii=False)
print('\n'.join(m['name']+' '+m['version'] for m in mods))

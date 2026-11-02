import 'server-only';
export async function getAdminAppearance() {
 try {
  const base=(process.env.NEXT_PUBLIC_API_BASE_URL||'http://localhost:4000').replace(/\/$/,'');
  const response=await fetch(`${base}/api/admin/v1/appearance`,{cache:'no-store',signal:AbortSignal.timeout(2500)});
  if(response.ok){const payload=await response.json();if(payload.data?.schemaVersion===1&&typeof payload.data.cssText==='string')return payload.data;}
 }catch{/* Login must remain renderable while the API is unavailable. */}
 return {schemaVersion:1,mode:'system',cssText:'',revision:'fallback',scope:{kind:'admin',tenantId:null,storeId:null}};
}

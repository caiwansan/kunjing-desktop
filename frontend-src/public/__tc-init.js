/* __tc-init.js — token-cache bridge for Nuxt SPA
   Injected by nuxt.config.ts nitro.hooks.compiled */

(function(){if(window.__tc)return;
var M={},ls=window.localStorage;
function g(k){try{return ls.getItem(k)||''}catch(e){return ''}}
function s(k,v){try{ls.setItem(k,v)}catch(e){}}
function r(k){try{ls.removeItem(k)}catch(e){}}
var TK=['auth_token','accessToken','token'],UK='auth_user';
M.getToken=function(){if(M._t)return M._t;
for(var i=0;i<TK.length;i++){var v=g(TK[i]);if(v){M._t=v;return v}}return ''};
M.setToken=function(t){M._t=t;for(var i=0;i<TK.length;i++)s(TK[i],t)};
M.getUser=function(){if(M._u)return M._u;var u=g(UK);if(u){try{M._u=JSON.parse(u)}catch(e){}}
return M._u||null};
M.setUser=function(u){M._u=u;if(u)s(UK,JSON.stringify(u));else r(UK)};
M.clearAuth=function(){M._t='';M._u=null;for(var i=0;i<TK.length;i++)r(TK[i]);r(UK);
document.cookie='auth_token=;path=/;max-age=0';document.cookie='auth_user=;path=/;max-age=0'};
M.isAuthenticated=function(){return!!M.getToken()};
window.__tc=M;
})();
